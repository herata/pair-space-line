import { messagingApi } from "@line/bot-sdk";
import type { Env } from "./types";

// ---- LINE SDK client --------------------------------------------------------
export const getLineClient = (env: Env) =>
	new messagingApi.MessagingApiClient({
		channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
	});
