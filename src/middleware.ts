import type { Context } from "hono";
import type { Env } from "./types";

// Add error handling middleware
export const errorHandler = (err: Error, c: Context<{ Bindings: Env }>) => {
	console.error("🚨 Unhandled application error:", err);
	return c.json({ error: "Internal server error" }, 500);
};

// Add request logging middleware
export const requestLogger = async (c: Context, next: () => Promise<void>) => {
	const start = Date.now();
	const method = c.req.method;
	const path = c.req.path;

	console.log(`📥 ${method} ${path} - Request started`);

	await next();

	const end = Date.now();
	const status = c.res.status;
	console.log(`📤 ${method} ${path} - ${status} (${end - start}ms)`);
};
