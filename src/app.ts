import "express-async-errors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { mcpRouter } from "./mcp/server";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import {
    apiLoggingMiddleware,
    mcpLoggingMiddleware,
} from "./middleware/logging";
import { handleRedirect, urlRouter } from "./routes/url.router";

export const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const rateLimitDefaults = {
    windowMs: 15 * 60 * 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
};

// Authenticated API endpoints
const limiter = rateLimit({ ...rateLimitDefaults, max: 100 });

// MCP — authenticated but can be chatty with many tool calls per session
const mcpLimiter = rateLimit({ ...rateLimitDefaults, max: 300 });

// Public redirect endpoint — higher ceiling, still guards against enumeration
const redirectLimiter = rateLimit({ ...rateLimitDefaults, max: 300 });

app.get("/health", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            status: "ok",
            database: "connected",
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        logger.error("[health] database check failed", err);
        res.status(503).json({
            status: "error",
            database: "disconnected",
        });
    }
});

if (env.ENABLE_API) {
    app.use("/urls", limiter, authMiddleware, apiLoggingMiddleware, urlRouter);
}
if (env.ENABLE_MCP) {
    app.use(
        "/mcp",
        mcpLimiter,
        authMiddleware,
        mcpLoggingMiddleware,
        mcpRouter,
    );
}
app.get("/:slug", redirectLimiter, handleRedirect);

// Global error handler - must be last
app.use(errorHandler);
