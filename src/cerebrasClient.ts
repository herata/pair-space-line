import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type { Env } from "./types";

// ---- Cerebras client --------------------------------------------------------
export const getCerebrasClient = (env: Env) =>
	new Cerebras({
		apiKey: env.CEREBRAS_API_KEY,
	});

// ---- AI Chat helpers --------------------------------------------------------
export const generateAIResponse = async (
	cerebras: Cerebras,
	messages: Array<{ role: "user" | "assistant"; content: string }>,
) => {
	try {
		console.log("🔄 Calling Cerebras API...");

		const systemMessage = {
			role: "system" as const,
			content:
				"あなたは親切で知識豊富なアシスタントです。日本語で回答してください。住宅や不動産に関する質問には特に詳しく答えてください。\n\n重要な注意事項：\n- マークダウン記法（**太字**、*斜体*、`コード`、#見出し、リストの- や1.など）は一切使用しないでください\n- 代わりに絵文字を積極的に使用して、読みやすく親しみやすい回答にしてください\n- 改行と適切な絵文字で情報を整理してください\n- 箇条書きが必要な場合は絵文字を使って視覚的に分かりやすくしてください（例：🏠 住宅情報、💰 費用について、など）",
		};

		const completion = await cerebras.chat.completions.create({
			messages: [systemMessage, ...messages],
			model: "llama3.1-8b",
			max_tokens: 500,
			temperature: 0.7,
		});

		// Type assertion for Cerebras response
		const response = completion as {
			choices: Array<{ message: { content: string } }>;
		};
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
