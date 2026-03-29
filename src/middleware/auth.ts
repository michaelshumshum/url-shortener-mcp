import type { NextFunction, Request, Response } from "express";
import type { User } from "../../generated/prisma/client";
import { verifyKey } from "../lib/crypto";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

// Per-user cache keyed by user ID to avoid a full table scan on every request
const USER_CACHE = new Map<string, { user: User; expiresAt: number }>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Looks up a single user by verifying the provided key against each cached/fetched record.
 * Fetches all users once per TTL window, then caches individually.
 */
async function findUserByKey(key: string): Promise<User | undefined> {
    const now = Date.now();

    // Try the cache first
    for (const [id, entry] of USER_CACHE) {
        if (entry.expiresAt < now) {
            USER_CACHE.delete(id);
            continue;
        }
        if (verifyKey(key, entry.user.salt, entry.user.key)) {
            return entry.user;
        }
    }

    // Cache miss — fetch all users, populate cache, retry
    const users = await prisma.user.findMany();
    for (const u of users) {
        USER_CACHE.set(u.id, { user: u, expiresAt: now + CACHE_TTL });
    }

    return users.find((u) => verifyKey(key, u.salt, u.key));
}

export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const authorization = req.headers.authorization;

        if (!authorization) {
            res.status(401).json({ error: "Missing Authorization header" });
            return;
        }

        if (!authorization.startsWith("Bearer ")) {
            res.status(401).json({
                error: "Authorization header must use Bearer scheme",
            });
            return;
        }

        const key = authorization.slice(7);

        if (!key) {
            res.status(401).json({ error: "Missing API key" });
            return;
        }

        const user = await findUserByKey(key);

        if (!user) {
            res.status(401).json({ error: "Invalid API key" });
            return;
        }

        req.user = user;
        next();
    } catch (err) {
        logger.error("[authMiddleware] error", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
