import type { UserState } from "./types";

// ---- KV State management helpers --------------------------------------------
export const getUserState = async (
	kv: KVNamespace,
	userId: string,
): Promise<UserState> => {
	try {
		console.log(`📖 Loading user state for user: ${userId}`);
		const state = await kv.get(`user:${userId}`, "json");
		const result = state || {
			mode: "diagnostic" as const,
			diagnosticStep: 0,
			diagnosticAnswers: {},
			chatHistory: [],
			lastActivity: new Date().toISOString(),
		};
		console.log(
			`📖 User state loaded: mode=${result.mode}, step=${result.diagnosticStep}, chatHistory=${result.chatHistory.length} messages`,
		);
		return result;
	} catch (error) {
		console.error(`❌ Error loading user state for user ${userId}:`, error);
		// Return default state on error
		return {
			mode: "diagnostic",
			diagnosticStep: 0,
			diagnosticAnswers: {},
			chatHistory: [],
			lastActivity: new Date().toISOString(),
		};
	}
};

export const setUserState = async (
	kv: KVNamespace,
	userId: string,
	state: UserState,
): Promise<void> => {
	try {
		// Update last activity
		state.lastActivity = new Date().toISOString();

		console.log(
			`💾 Saving user state for user: ${userId} (mode=${state.mode}, chatHistory=${state.chatHistory.length} messages)`,
		);
		await kv.put(`user:${userId}`, JSON.stringify(state));
		console.log("💾 User state saved successfully");
	} catch (error) {
		console.error(`❌ Error saving user state for user ${userId}:`, error);
		throw error; // Re-throw to let caller handle
	}
};
