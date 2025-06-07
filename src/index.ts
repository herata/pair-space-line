import { messagingApi, validateSignature } from "@line/bot-sdk";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
// PairSpace LINE Bot with Cerebras AI — Cloudflare Workers (Hono + @line/bot-sdk + Cerebras)
// ---------------------------------------------------------------------------------
// 1.  npm i hono @line/bot-sdk @cerebras/cerebras_cloud_sdk
// 2.  wrangler.toml → define env vars: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, CEREBRAS_API_KEY
// 3.  wrangler deploy
// ---------------------------------------------------------------------------------
import { Hono } from "hono";

// ---- Type definitions -------------------------------------------------------
declare global {
	interface KVNamespace {
		get(key: string, type?: "text"): Promise<string | null>;
		get(key: string, type: "json"): Promise<ChatState | null>;
		put(key: string, value: string): Promise<void>;
		delete(key: string): Promise<void>;
	}
}

// ---- Cloudflare env typing --------------------------------------------------
interface Env {
	LINE_CHANNEL_SECRET: string;
	LINE_CHANNEL_ACCESS_TOKEN: string;
	CEREBRAS_API_KEY: string;
	USER_STATE: KVNamespace;
}

// ---- Chat state type -------------------------------------------------------
interface ChatState {
	messages: Array<{
		role: "user" | "assistant";
		content: string;
	}>;
}

// ---- LINE SDK client --------------------------------------------------------
const getLineClient = (env: Env) =>
	new messagingApi.MessagingApiClient({
		channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
	});

// ---- Cerebras client --------------------------------------------------------
const getCerebrasClient = (env: Env) =>
	new Cerebras({
		apiKey: env.CEREBRAS_API_KEY,
	});

// ---- KV State management helpers --------------------------------------------
const getChatState = async (kv: KVNamespace, userId: string): Promise<ChatState> => {
	try {
		console.log(`📖 Loading chat state for user: ${userId}`);
		const state = await kv.get(`chat:${userId}`, "json");
		const result = state || { messages: [] };
		console.log(`📖 Chat state loaded: ${result.messages.length} messages`);
		return result;
	} catch (error) {
		console.error(`❌ Error loading chat state for user ${userId}:`, error);
		// Return empty state on error
		return { messages: [] };
	}
};

const setChatState = async (kv: KVNamespace, userId: string, state: ChatState): Promise<void> => {
	try {
		console.log(`💾 Saving chat state for user: ${userId} (${state.messages.length} messages)`);
		await kv.put(`chat:${userId}`, JSON.stringify(state));
		console.log("💾 Chat state saved successfully");
	} catch (error) {
		console.error(`❌ Error saving chat state for user ${userId}:`, error);
		throw error; // Re-throw to let caller handle
	}
};

// ---- AI Chat helpers --------------------------------------------------------
const generateAIResponse = async (cerebras: Cerebras, messages: Array<{ role: "user" | "assistant"; content: string }>) => {
	try {
		console.log("🔄 Calling Cerebras API...");
		
		const systemMessage = {
			role: "system" as const,
			content: "あなたは親切で知識豊富なアシスタントです。日本語で回答してください。住宅や不動産に関する質問には特に詳しく答えてください。\n\n重要な注意事項：\n- マークダウン記法（**太字**、*斜体*、`コード`、#見出し、リストの- や1.など）は一切使用しないでください\n- 代わりに絵文字を積極的に使用して、読みやすく親しみやすい回答にしてください\n- 改行と適切な絵文字で情報を整理してください\n- 箇条書きが必要な場合は絵文字を使って視覚的に分かりやすくしてください（例：🏠 住宅情報、💰 費用について、など）"
		};

		const completion = await cerebras.chat.completions.create({
			messages: [systemMessage, ...messages],
			model: "llama3.1-8b",
			max_tokens: 500,
			temperature: 0.7,
		});

		// Type assertion for Cerebras response
		const response = completion as { choices: Array<{ message: { content: string } }> };
		const content = response.choices?.[0]?.message?.content;
		
		if (!content) {
			console.error("❌ No content in Cerebras response");
			throw new Error("No content received from Cerebras API");
		}
		
		console.log("✅ Cerebras API response received successfully");
		return content;
	} catch (error) {
		console.error("❌ Cerebras API error:", error);
		throw error;
	}
};

// ---- Hono app ---------------------------------------------------------------
const app = new Hono<{ Bindings: Env }>();

// Add error handling middleware
app.onError((err, c) => {
	console.error("🚨 Unhandled application error:", err);
	return c.json({ error: "Internal server error" }, 500);
});

// Add request logging middleware
app.use("*", async (c, next) => {
	const start = Date.now();
	const method = c.req.method;
	const path = c.req.path;
	
	console.log(`📥 ${method} ${path} - Request started`);
	
	await next();
	
	const end = Date.now();
	const status = c.res.status;
	console.log(`📤 ${method} ${path} - ${status} (${end - start}ms)`);
});

// Health check endpoint for monitoring
app.get("/health", (c) => {
	console.log("💚 Health check requested");
	return c.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.post("/webhook", async (c) => {
	const body = await c.req.text();
	const signature = c.req.header("x-line-signature");
	
	// Validate LINE signature
	if (!signature || !validateSignature(body, c.env.LINE_CHANNEL_SECRET, signature)) {
		console.error("❌ Invalid signature");
		return c.text("Bad signature", 400);
	}

	console.log("✅ Webhook received and validated");

	const events = JSON.parse(body).events as unknown[];
	const client = getLineClient(c.env);
	const cerebras = getCerebrasClient(c.env);
	const replies: Promise<unknown>[] = [];

	for (const ev of events) {
		const event = ev as {
			type: string;
			source: { userId: string };
			replyToken: string;
			message?: { type: string; text?: string };
		};
		const uid = event.source.userId;

		console.log(`📋 Processing event: ${event.type} for user: ${uid}`);

		if (event.type === "follow") {
			// Welcome message when user follows the bot
			console.log("👋 User followed bot, sending welcome message");
			replies.push(
				client.replyMessage({
					replyToken: event.replyToken,
					messages: [
						{
							type: "text",
							text: "こんにちは！PairSpace AIチャットボットです🤖\n\n住宅や不動産に関するご質問、その他何でもお気軽にお聞きください！",
						},
					],
				}),
			);
			continue;
		}

		if (event.type === "message" && event.message?.type === "text") {
			const userMessage = event.message.text;
			
			if (!userMessage) {
				console.log("⚠️ Received empty message, skipping");
				continue;
			}
			
			console.log(`👤 User message: ${userMessage}`);
			
			// Get chat history
			const chatState = await getChatState(c.env.USER_STATE, uid);
			console.log(`📚 Retrieved chat history: ${chatState.messages.length} messages`);
			
			// Add user message to history
			chatState.messages.push({
				role: "user",
				content: userMessage,
			});

			try {
				console.log("🧠 Generating AI response...");
				// Generate AI response
				const aiResponse = await generateAIResponse(cerebras, chatState.messages);
				
				console.log(`🤖 AI response generated: ${aiResponse.substring(0, 100)}...`);
				
				// Add AI response to history
				chatState.messages.push({
					role: "assistant",
					content: aiResponse,
				});

				// Keep only last 10 messages to avoid hitting limits
				if (chatState.messages.length > 10) {
					chatState.messages = chatState.messages.slice(-10);
					console.log("✂️ Trimmed chat history to 10 messages");
				}

				// Save updated chat state
				await setChatState(c.env.USER_STATE, uid, chatState);
				console.log("💾 Chat state saved to KV");

				// Reply to user
				replies.push(
					client.replyMessage({
						replyToken: event.replyToken,
						messages: [
							{
								type: "text",
								text: aiResponse,
							},
						],
					}),
				);
				console.log("📤 Reply message queued");
			} catch (error) {
				console.error("❌ Error generating AI response:", error);
				const errorMessage = "申し訳ありません。一時的にサービスが利用できません。しばらく時間をおいてから再度お試しください。";
				
				replies.push(
					client.replyMessage({
						replyToken: event.replyToken,
						messages: [
							{
								type: "text",
								text: errorMessage,
							},
						],
					}),
				);
				console.log("🚨 Error response queued");
			}
		}
	}

	console.log(`📨 Sending ${replies.length} replies`);
	await Promise.all(replies);
	console.log("✅ All replies sent successfully");
	
	return c.json({ status: "ok" });
});

/*
// ---- COMMENTED OUT: Original housing subsidy diagnostic flow ----
// ---- This is the previous implementation that has been replaced ----

// ---- User state type (OLD) -------------------------------------------------------
interface UserState {
	step: number; // 0 = Q1, 1 = Q2, 2 = Q3, 99 = done
	answers: {
		subsidy?: boolean;
		subsidyAmount?: number;
		rent?: string;
	};
}

// ---- KV State management helpers (OLD) --------------------------------------------
const getUserState = async (
	kv: KVNamespace,
	userId: string,
): Promise<UserState> => {
	const state = await kv.get(`user:${userId}`, "json");
	return state || { step: 0, answers: {} };
};

const setUserState = async (
	kv: KVNamespace,
	userId: string,
	state: UserState,
): Promise<void> => {
	await kv.put(`user:${userId}`, JSON.stringify(state));
};

// ---- QuickReply helpers (OLD) -----------------------------------------------------
const quick = (text: string, labels: string[], datas: string[]) => ({
	type: "text" as const,
	text,
	quickReply: {
		items: labels.map((label, i) => ({
			type: "action" as const,
			action: { type: "postback" as const, label, data: datas[i] },
		})),
	},
});

// ---- Flex Message Result (OLD) ----------------------------------------------------
const resultFlex = (subsidy: number, rent: string) => ({
	type: "flex" as const,
	altText: "診断結果",
	contents: {
		type: "bubble" as const,
		header: {
			type: "box" as const,
			layout: "vertical" as const,
			contents: [
				{
					type: "text" as const,
					text: "PairSpace 診断結果",
					weight: "bold" as const,
					size: "lg" as const,
				},
			],
		},
		body: {
			type: "box" as const,
			layout: "vertical" as const,
			spacing: "md" as const,
			contents: [
				{
					type: "text" as const,
					text: `家賃補助：最大 ¥${subsidy.toLocaleString()}`,
				},
				{ type: "text" as const, text: `希望家賃帯：${rent}` },
				{ type: "text" as const, text: "実質負担を大幅カットできます！" },
			],
		},
		footer: {
			type: "box" as const,
			layout: "vertical" as const,
			contents: [
				{
					type: "button" as const,
					style: "primary" as const,
					action: {
						type: "uri" as const,
						label: "Zoom無料相談を予約",
						uri: "https://liff.line.me/XXXXXXXX", // ← LIFF URL
					},
				},
			],
		},
	},
});

// ---- OLD WEBHOOK IMPLEMENTATION ----
// The housing subsidy diagnostic flow with QuickReply interactions
// This implementation used step-based conversation flow:
// 1. Follow event → Ask about housing subsidy (yes/no)
// 2. Postback subsidy → Ask about subsidy amount (5万円以上/3万円/1万円以下)
// 3. Postback amount → Ask about rent range (10-13万/13-16万/16万以上)
// 4. Postback rent → Show Flex Message result with calculated recommendation

// The new AI chat implementation above replaces this structured flow
// with open-ended conversation powered by Cerebras AI.
*/

export default app;
