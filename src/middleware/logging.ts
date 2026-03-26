import type { JSONRPCRequest } from "@modelcontextprotocol/sdk/types.js";
import type { NextFunction, Request, Response } from "express";

function mcpLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const method = req.method;

    const body = req.body as JSONRPCRequest;

    const userId = req.user ? req.user.id : "anonymous";
    res.on("finish", () => {
        const duration = Date.now() - startTime;
        console.log(
            `[MCP] ${new Date(Date.now()).toISOString()} ${method} - User: ${userId} - <${res.statusCode}> - ${body.method} - ${body.params ? JSON.stringify(body.params) : "{}"} ${duration}ms`,
        );
    });

    next();
}

function apiLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const method = req.method;
    const url = req.originalUrl;
    const userId = req.user ? req.user.id : "anonymous";
    console.log(`[API] ${method} ${url} - User: ${userId}`);

    res.on("finish", () => {
        const duration = Date.now() - startTime;
        console.log(
            `[API] ${method} ${url} - User: ${userId} - Status: ${res.statusCode} - Duration: ${duration}ms`,
        );
    });

    next();
}

export { apiLoggingMiddleware, mcpLoggingMiddleware };
