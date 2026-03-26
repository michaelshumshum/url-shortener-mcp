import type { NextFunction, Request, Response } from "express";
import { env } from "../lib/env";
import {
    AlreadyExistsError,
    ExpiryTooLargeError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
} from "../lib/errors";
import { logger } from "../lib/logger";

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {
    logger.error("[error]", err);

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

    const message =
        env.NODE_ENV === "production" ? "Internal server error" : err.message;

    res.status(500).json({ error: message });
}
