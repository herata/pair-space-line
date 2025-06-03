import {
	type MessageEvent,
	type TextEventMessage,
	type WebhookEvent,
	messagingApi,
	validateSignature,
} from "@line/bot-sdk";
import { Hono } from "hono";

type Bindings = {
	LINE_CHANNEL_ACCESS_TOKEN: string;
	LINE_CHANNEL_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

app.post("/webhook", async (c) => {
	const channelSecret = c.env.LINE_CHANNEL_SECRET;
	const channelAccessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;

	// Initialize LINE Client (using new MessagingApiClient)
	const client = new messagingApi.MessagingApiClient({
		channelAccessToken: channelAccessToken,
	});

	try {
		const body = await c.req.text();
		const signature = c.req.header("x-line-signature");

		if (!signature) {
			return c.text("No signature", 400);
		}

		// Validate webhook signature
		if (!validateSignature(body, channelSecret, signature)) {
			return c.text("Invalid signature", 400);
		}

		const events: WebhookEvent[] = JSON.parse(body).events;

		// Process each event
		await Promise.all(
			events.map(async (event: WebhookEvent) => {
				if (event.type === "message" && event.message.type === "text") {
					const messageEvent = event as MessageEvent;
					const textMessage = messageEvent.message as TextEventMessage;

					// Echo user's message
					await client.replyMessage({
						replyToken: messageEvent.replyToken,
						messages: [
							{
								type: "text",
								text: textMessage.text,
							},
						],
					});
				}
			}),
		);

		return c.json({ status: "ok" });
	} catch (error) {
		console.error("Error processing webhook:", error);
		return c.text("Error", 500);
	}
});

export default app;
