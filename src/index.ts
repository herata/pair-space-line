// PairSpace LINE Bot with Cerebras AI — Cloudflare Workers (Hono + @line/bot-sdk + Cerebras)
// ---------------------------------------------------------------------------------
// Integrated features:
// 1. Friend follow: Start housing subsidy diagnostic flow
// 2. After diagnostic: Auto-transition to AI chat mode
// 3. Specific commands: "診断" to restart diagnostic flow
// 4. Button actions: "診断をやり直す" to restart diagnostic flow
// ---------------------------------------------------------------------------------
import { Hono } from "hono";
import { healthCheck, webhookHandler } from "./handlers";
import { errorHandler, requestLogger } from "./middleware";
import type { Env } from "./types";

// ---- Hono app ---------------------------------------------------------------
const app = new Hono<{ Bindings: Env }>();

// Add error handling middleware
app.onError(errorHandler);

// Add request logging middleware
app.use("*", requestLogger);

// Health check endpoint for monitoring
app.get("/health", healthCheck);

// Main webhook endpoint
app.post("/webhook", webhookHandler);

export default app;
