import type { NextFunction, Request, Response } from "express";
import { env } from "../lib/env";
import { ValidationError } from "../lib/errors";
import { logger } from "../lib/logger";

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {
    if ("statusCode" in err && typeof err.statusCode === "number") {
        const body: Record<string, unknown> = { error: err.message };
        if (err instanceof ValidationError && err.details) {
            body.details = err.details;
        }
        res.status(err.statusCode).json(body);
        return;
    }

    logger.error("[error] unhandled", err);
    const message =
        env.NODE_ENV === "production" ? "Internal server error" : err.message;
    res.status(500).json({ error: message });
}
