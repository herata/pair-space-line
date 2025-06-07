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
export interface Env {
	LINE_CHANNEL_SECRET: string;
	LINE_CHANNEL_ACCESS_TOKEN: string;
	CEREBRAS_API_KEY: string;
	USER_STATE: KVNamespace;
}

// ---- User state type - integrates diagnostic flow and AI chat -------------
export interface UserState {
	mode: "diagnostic" | "chat"; // Current mode
	diagnosticStep?: number; // 0 = Q1, 1 = Q2, 2 = Q3, 99 = done
	diagnosticAnswers?: {
		subsidy?: boolean;
		subsidyAmount?: number;
		rent?: string;
	};
	chatHistory: Array<{
		role: "user" | "assistant";
		content: string;
	}>;
	lastActivity: string; // ISO timestamp
}
