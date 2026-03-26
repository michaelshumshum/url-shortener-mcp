import type { NextFunction, Request, Response } from "express";
import type { User } from "../../generated/prisma/client";
import { verifyKey } from "../lib/crypto";
import { prisma } from "../lib/prisma";

// In-memory cache for users to avoid loading all users on every request
const USERS_CACHE = new Map<
    string,
    { id: string; salt: string; key: string }
>();
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Retrieves users from cache or database
 * Refreshes cache if it's expired or empty
 */
async function getUsersWithCache(): Promise<Array<User>> {
    const now = Date.now();
    if (now - lastCacheUpdate > CACHE_TTL || USERS_CACHE.size === 0) {
        const users = await prisma.user.findMany();
        USERS_CACHE.clear();
        for (const u of users) {
            USERS_CACHE.set(u.id, u);
        }
        lastCacheUpdate = now;
    }
    return Array.from(USERS_CACHE.values());
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

        const users = await getUsersWithCache();
        const user = users.find((u) => verifyKey(key, u.salt, u.key));

        if (!user) {
            res.status(401).json({ error: "Invalid API key" });
            return;
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("[authMiddleware] Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
