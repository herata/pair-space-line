import type { UserState } from "./types";

// ---- QuickReply helpers -----------------------------------------------------
export const createQuickReply = (
	text: string,
	labels: string[],
	datas: string[],
) => ({
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
export const createResultFlex = (subsidy: number, rent: string) => ({
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
					text: "🏠 PairSpace 診断結果",
					weight: "bold" as const,
					size: "lg" as const,
					color: "#1DB446",
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
					text: `💰 家賃補助：最大 ¥${subsidy.toLocaleString()}`,
					size: "lg" as const,
					weight: "bold" as const,
				},
				{
					type: "text" as const,
					text: `🏘️ 希望家賃帯：${rent}`,
					size: "md" as const,
				},
				{
					type: "text" as const,
					text: "✨ 実質負担を大幅カットできます！",
					size: "md" as const,
					color: "#1DB446",
				},
				{
					type: "separator" as const,
					margin: "md" as const,
				},
				{
					type: "text" as const,
					text: "🤖 この後はAIチャットで何でもご質問いただけます！",
					size: "sm" as const,
					color: "#666666",
					wrap: true,
				},
			],
		},
		footer: {
			type: "box" as const,
			layout: "vertical" as const,
			spacing: "sm" as const,
			contents: [
				{
					type: "button" as const,
					style: "primary" as const,
					height: "sm" as const,
					action: {
						type: "uri" as const,
						label: "📞 Zoom無料相談を予約",
						uri: "https://liff.line.me/XXXXXXXX", // ← Change to actual LIFF URL
					},
				},
				{
					type: "button" as const,
					style: "secondary" as const,
					height: "sm" as const,
					action: {
						type: "postback" as const,
						label: "🔄 診断をやり直す",
						data: "restart_diagnostic",
					},
				},
			],
		},
	},
});

// ---- Diagnostic flow helpers ------------------------------------------------
export const getDiagnosticMessage = (step: number) => {
	switch (step) {
		case 0:
			return createQuickReply(
				"🏠 PairSpace診断にようこそ！\n\nまず、現在の会社で家賃補助制度はありますか？",
				["はい", "いいえ"],
				["subsidy_yes", "subsidy_no"],
			);
		case 1:
			return createQuickReply(
				"💰 家賃補助の金額はどのくらいですか？",
				["5万円以上", "3万円程度", "1万円以下"],
				["amount_high", "amount_medium", "amount_low"],
			);
		case 2:
			return createQuickReply(
				"🏘️ 希望する家賃帯を教えてください",
				["10-13万円", "13-16万円", "16万円以上"],
				["rent_low", "rent_medium", "rent_high"],
			);
		default:
			return {
				type: "text" as const,
				text: "診断が完了しました！🎉",
			};
	}
};

// ---- Calculate subsidy amount -----------------------------------------------
export const calculateSubsidy = (answers: UserState["diagnosticAnswers"]) => {
	if (!answers?.subsidy) return 0;

	const baseAmount = answers.subsidyAmount || 0;
	// 簡単な計算ロジック（実際のビジネスロジックに合わせて調整）
	return baseAmount;
};

// ---- Get rent range string --------------------------------------------------
export const getRentRangeString = (rent: string) => {
	switch (rent) {
		case "rent_low":
			return "10-13万円";
		case "rent_medium":
			return "13-16万円";
		case "rent_high":
			return "16万円以上";
		default:
			return "未設定";
	}
};
