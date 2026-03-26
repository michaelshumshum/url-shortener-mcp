import type { JSONRPCRequest } from "@modelcontextprotocol/sdk/types.js";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

function mcpLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const userId = req.user ? req.user.id : "anonymous";
    const body = req.body as JSONRPCRequest;

    res.on("finish", () => {
        const duration = Date.now() - startTime;
        const rpcMethod = body?.method ?? "-";
        logger.info(
            `[MCP] ${req.method} - user:${userId} - ${res.statusCode} - ${rpcMethod} ${duration}ms`,
        );
    });

    next();
}

function apiLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const userId = req.user ? req.user.id : "anonymous";

    res.on("finish", () => {
        const duration = Date.now() - startTime;
        logger.info(
            `[API] ${req.method} ${req.originalUrl} - user:${userId} - ${res.statusCode} ${duration}ms`,
        );
    });

    next();
}

export { apiLoggingMiddleware, mcpLoggingMiddleware };
