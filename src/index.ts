import { messagingApi, validateSignature } from "@line/bot-sdk";
// PairSpace LINE Bot — Cloudflare Workers (Hono + @line/bot-sdk)
// ---------------------------------------------------------------
// 1.  npm i hono @line/bot-sdk
// 2.  wrangler.toml → define env vars: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN
// 3.  wrangler deploy
// ---------------------------------------------------------------
import { Hono } from "hono";

// ---- Type definitions -------------------------------------------------------
declare global {
	interface KVNamespace {
		get(key: string, type?: "text"): Promise<string | null>;
		get(key: string, type: "json"): Promise<UserState | null>;
		put(key: string, value: string): Promise<void>;
		delete(key: string): Promise<void>;
	}
}

// ---- Cloudflare env typing --------------------------------------------------
interface Env {
	LINE_CHANNEL_SECRET: string;
	LINE_CHANNEL_ACCESS_TOKEN: string;
	USER_STATE: KVNamespace;
}

// ---- User state type -------------------------------------------------------
interface UserState {
	step: number; // 0 = Q1, 1 = Q2, 2 = Q3, 99 = done
	answers: {
		subsidy?: boolean;
		subsidyAmount?: number;
		rent?: string;
	};
}

// ---- LINE SDK client --------------------------------------------------------
const getLineClient = (env: Env) =>
	new messagingApi.MessagingApiClient({
		channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
	});

// ---- KV State management helpers --------------------------------------------
const getUserState = async (kv: KVNamespace, userId: string): Promise<UserState> => {
	const state = await kv.get(`user:${userId}`, "json");
	return state || { step: 0, answers: {} };
};

const setUserState = async (kv: KVNamespace, userId: string, state: UserState): Promise<void> => {
	await kv.put(`user:${userId}`, JSON.stringify(state));
};

// ---- QuickReply helpers -----------------------------------------------------
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

// ---- Flex Message Result ----------------------------------------------------
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

// ---- Hono app ---------------------------------------------------------------
const app = new Hono<{ Bindings: Env }>();

app.post("/webhook", async (c) => {
	const body = await c.req.text();
	const signature = c.req.header("x-line-signature");
	if (
		!signature ||
		!validateSignature(body, c.env.LINE_CHANNEL_SECRET, signature)
	) {
		return c.text("Bad signature", 400);
	}

	const events = JSON.parse(body).events as unknown[];
	const client = getLineClient(c.env);
	const replies: Promise<unknown>[] = [];

	for (const ev of events) {
		const event = ev as {
			type: string;
			source: { userId: string };
			replyToken: string;
			postback?: { data: string };
			message?: { type: string; text?: string };
		};
		const uid = event.source.userId;

		if (event.type === "follow") {
			const state: UserState = { step: 0, answers: {} };
			await setUserState(c.env.USER_STATE, uid, state);
			replies.push(
				client.replyMessage({
					replyToken: event.replyToken,
					messages: [
						quick(
							"住宅手当はありますか？",
							["ある", "ない"],
							["subsidy=yes", "subsidy=no"],
						),
					],
				}),
			);
			continue;
		}

		if (event.type === "postback" && event.postback) {
			const data: string = event.postback.data;
			const state = await getUserState(c.env.USER_STATE, uid);

			if (state.step === 0) {
				state.answers.subsidy = data.split("=")[1] === "yes";
				state.step = 1;
				await setUserState(c.env.USER_STATE, uid, state);
				replies.push(
					client.replyMessage({
						replyToken: event.replyToken,
						messages: [
							quick(
								"上限はいくらですか？",
								["5万円以上", "3万円", "1万円以下"],
								["subsidy=5", "subsidy=3", "subsidy=1"],
							),
						],
					}),
				);
			} else if (state.step === 1) {
				state.answers.subsidyAmount = Number(data.split("=")[1]);
				state.step = 2;
				await setUserState(c.env.USER_STATE, uid, state);
				replies.push(
					client.replyMessage({
						replyToken: event.replyToken,
						messages: [
							quick(
								"希望家賃帯は？",
								["10-13万", "13-16万", "16万以上"],
								["rent=10-13", "rent=13-16", "rent=16+"],
							),
						],
					}),
				);
			} else if (state.step === 2) {
				state.answers.rent = data.split("=")[1];
				state.step = 99;
				await setUserState(c.env.USER_STATE, uid, state);
				
				const { subsidyAmount, rent } = state.answers;
				if (subsidyAmount && rent) {
					replies.push(
						client.replyMessage({
							replyToken: event.replyToken,
							messages: [resultFlex(subsidyAmount * 10000, rent)],
						}),
					);
				}
			}
		}

		// Handle text messages - show quick reply if user hasn't started or is lost
		if (event.type === "message" && event.message?.type === "text") {
			const state = await getUserState(c.env.USER_STATE, uid);
			if (state.step === undefined || state.step === 99) {
				// User hasn't started or finished - restart the flow
				const newState: UserState = { step: 0, answers: {} };
				await setUserState(c.env.USER_STATE, uid, newState);
				replies.push(
					client.replyMessage({
						replyToken: event.replyToken,
						messages: [
							quick(
								"住宅手当はありますか？",
								["ある", "ない"],
								["subsidy=yes", "subsidy=no"],
							),
						],
					}),
				);
			}
		}
	}

	await Promise.all(replies);
	return c.json({ status: "ok" });
});

export default app;
