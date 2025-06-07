import { validateSignature } from "@line/bot-sdk";
import type { Context } from "hono";
import { generateAIResponse, getCerebrasClient } from "./cerebrasClient";
import {
	calculateSubsidy,
	createResultFlex,
	getDiagnosticMessage,
	getRentRangeString,
} from "./diagnosticFlow";
import { getUserState, setUserState } from "./kvStore";
import { getLineClient } from "./lineClient";
import type { Env, UserState } from "./types";

// Health check endpoint for monitoring
export const healthCheck = (c: Context<{ Bindings: Env }>) => {
	console.log("💚 Health check requested");
	return c.json({ status: "healthy", timestamp: new Date().toISOString() });
};

// ---- Process diagnostic flow ------------------------------------------------
const processDiagnosticFlow = async (
	replyToken: string,
	userState: UserState,
	data?: string,
) => {
	if (data === "restart_diagnostic") {
		// Restart diagnostic flow
		userState.mode = "diagnostic";
		userState.diagnosticStep = 0;
		userState.diagnosticAnswers = {};
		return getDiagnosticMessage(0);
	}

	const step = userState.diagnosticStep || 0;

	// Save answers based on data
	if (data) {
		if (!userState.diagnosticAnswers) {
			userState.diagnosticAnswers = {};
		}

		if (step === 0) {
			// Housing subsidy availability
			userState.diagnosticAnswers.subsidy = data === "subsidy_yes";
		} else if (step === 1) {
			// Subsidy amount
			const amounts = {
				amount_high: 50000,
				amount_medium: 30000,
				amount_low: 10000,
			};
			userState.diagnosticAnswers.subsidyAmount =
				amounts[data as keyof typeof amounts] || 0;
		} else if (step === 2) {
			// Rent range
			userState.diagnosticAnswers.rent = data;
		}
	}

	// Move to next step
	userState.diagnosticStep = step + 1;

	if (userState.diagnosticStep <= 2) {
		// Still in diagnostic flow
		return getDiagnosticMessage(userState.diagnosticStep);
	}

	// Diagnostic completed
	userState.diagnosticStep = 99;
	userState.mode = "chat"; // Transition to AI chat mode

	const subsidy = calculateSubsidy(userState.diagnosticAnswers);
	const rentRange = getRentRangeString(userState.diagnosticAnswers?.rent || "");

	return createResultFlex(subsidy, rentRange);
};

// ---- Process AI chat --------------------------------------------------------
const processAIChat = async (
	cerebras: ReturnType<typeof getCerebrasClient>,
	userState: UserState,
	userMessage: string,
) => {
	// Add user message to chat history
	userState.chatHistory.push({
		role: "user",
		content: userMessage,
	});

	// Generate AI response
	const aiResponse = await generateAIResponse(cerebras, userState.chatHistory);

	// Add AI response to chat history
	userState.chatHistory.push({
		role: "assistant",
		content: aiResponse,
	});

	// Limit history to latest 10 messages
	if (userState.chatHistory.length > 10) {
		userState.chatHistory = userState.chatHistory.slice(-10);
		console.log("✂️ Trimmed chat history to 10 messages");
	}

	return aiResponse;
};

// Main webhook handler
export const webhookHandler = async (c: Context<{ Bindings: Env }>) => {
	const body = await c.req.text();
	const signature = c.req.header("x-line-signature");

	// Validate LINE signature
	if (
		!signature ||
		!validateSignature(body, c.env.LINE_CHANNEL_SECRET, signature)
	) {
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
			postback?: { data: string };
		};
		const uid = event.source.userId;

		console.log(`📋 Processing event: ${event.type} for user: ${uid}`);

		// Get user state
		const userState = await getUserState(c.env.USER_STATE, uid);

		if (event.type === "follow") {
			// Start diagnostic flow when user follows bot
			console.log("👋 User followed bot, starting diagnostic flow");
			userState.mode = "diagnostic";
			userState.diagnosticStep = 0;
			userState.diagnosticAnswers = {};

			const message = getDiagnosticMessage(0);

			replies.push(
				client.replyMessage({
					replyToken: event.replyToken,
					messages: [message],
				}),
			);

			await setUserState(c.env.USER_STATE, uid, userState);
			continue;
		}

		if (event.type === "postback") {
			// Postback from QuickReply or button
			console.log(`📝 Postback received: ${event.postback?.data}`);

			try {
				const message = await processDiagnosticFlow(
					event.replyToken,
					userState,
					event.postback?.data,
				);

				replies.push(
					client.replyMessage({
						replyToken: event.replyToken,
						messages: [message],
					}),
				);

				await setUserState(c.env.USER_STATE, uid, userState);
			} catch (error) {
				console.error("❌ Error processing diagnostic flow:", error);
				replies.push(
					client.replyMessage({
						replyToken: event.replyToken,
						messages: [
							{
								type: "text",
								text: "申し訳ありません。処理中にエラーが発生しました。もう一度お試しください。",
							},
						],
					}),
				);
			}
			continue;
		}

		if (event.type === "message" && event.message?.type === "text") {
			const userMessage = event.message.text;

			if (!userMessage) {
				console.log("⚠️ Received empty message, skipping");
				continue;
			}

			console.log(`👤 User message: ${userMessage}`);

			// Restart diagnostic flow with specific commands
			if (
				userMessage === "診断" ||
				userMessage === "診断開始" ||
				userMessage === "/diagnostic"
			) {
				console.log("🔄 Restarting diagnostic flow by command");
				userState.mode = "diagnostic";
				userState.diagnosticStep = 0;
				userState.diagnosticAnswers = {};

				const message = getDiagnosticMessage(0);

				replies.push(
					client.replyMessage({
						replyToken: event.replyToken,
						messages: [message],
					}),
				);

				await setUserState(c.env.USER_STATE, uid, userState);
				continue;
			}

			try {
				let responseText: string;

				if (userState.mode === "diagnostic") {
					// If in diagnostic mode, transition to AI chat with guidance message
					userState.mode = "chat";
					await setUserState(c.env.USER_STATE, uid, userState);

					responseText =
						"🤖 診断が完了していません。AIチャットモードに移行しました！\n\n住宅や不動産について何でもお聞きください。\n\n診断をやり直したい場合は「診断」と入力してください。";
				} else {
					// AI chat mode
					console.log("🧠 Processing AI chat...");
					responseText = await processAIChat(cerebras, userState, userMessage);
				}

				console.log(
					`🤖 Response generated: ${responseText.substring(0, 100)}...`,
				);

				// Save user state
				await setUserState(c.env.USER_STATE, uid, userState);

				// Send reply
				replies.push(
					client.replyMessage({
						replyToken: event.replyToken,
						messages: [
							{
								type: "text",
								text: responseText,
							},
						],
					}),
				);
				console.log("📤 Reply message queued");
			} catch (error) {
				console.error("❌ Error processing message:", error);
				const errorMessage =
					"申し訳ありません。一時的にサービスが利用できません。しばらく時間をおいてから再度お試しください。";

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
};
