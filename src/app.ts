import express, {
    type Express,
    type NextFunction,
    type Request,
    type Response,
} from "express";
import rateLimit from "express-rate-limit";
import { env } from "./lib/env";
import {
    AlreadyExistsError,
    ExpiryTooLargeError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
} from "./lib/errors";
import { prisma } from "./lib/prisma";
import { mcpRouter } from "./mcp/server";
import { authMiddleware } from "./middleware/auth";
import {
    apiLoggingMiddleware,
    mcpLoggingMiddleware,
} from "./middleware/logging";
import { handleRedirect, urlRouter } from "./routes/url.router";

export const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter for URL creation and management
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
});

app.get("/health", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            status: "ok",
            database: "connected",
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error("[health] Database check failed:", err);
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
    app.use("/mcp", authMiddleware, mcpLoggingMiddleware, mcpRouter);
}
app.get("/:slug", handleRedirect);

// Global error handler - must be last
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Error]", err);

    // Custom error handling
    if (err instanceof ValidationError) {
        res.status(400).json({
            error: err.message,
            ...(err.details && { details: err.details }),
        });
        return;
    }

    if (
        err instanceof ExpiryTooLargeError ||
        err instanceof AlreadyExistsError
    ) {
        res.status(400).json({ error: err.message });
        return;
    }

    if (err instanceof NotFoundError) {
        res.status(404).json({ error: err.message });
        return;
    }

    if (err instanceof ForbiddenError) {
        res.status(403).json({ error: err.message });
        return;
    }

    // Generic errors - don't leak details in production
    const message =
        env.NODE_ENV === "production" ? "Internal server error" : err.message;

    res.status(500).json({ error: message });
});
