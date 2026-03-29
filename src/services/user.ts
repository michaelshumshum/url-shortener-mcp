import { randomBytes } from "node:crypto";
import type { User } from "../../generated/prisma/client";
import { generateSalt, hashKey } from "../lib/crypto";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

/**
 * Creates a new user with a unique API key.
 * @returns newly created `User` and its key
 */
export async function createUser(): Promise<{
    user: User;
    key: string;
}> {
    const rawKey = randomBytes(32).toString("hex");
    const salt = generateSalt();
    const hashedKey = hashKey(rawKey, salt);

    const user = await prisma.user.create({
        data: {
            key: hashedKey,
            salt,
        },
    });

    return { user, key: rawKey };
}

/**
 * Deletes users who haven't created any URLs recently
 * @returns The number of deleted users
 */
export async function deleteInactiveUsers(): Promise<number> {
    const cutoff = new Date(
        Date.now() - env.INACTIVE_USER_CUTOFF_SECONDS * 1000,
    );
    const deletedUsers = await prisma.user.deleteMany({
        where: {
            lastActivity: {
                lt: cutoff,
            },
            urls: {
                none: {},
            },
        },
    });
    return deletedUsers.count;
}

/**
 * Updates the lastActivity timestamp for a user. Fire-and-forget — errors are logged but not propagated.
 */
export function updateUserActivity(userId: string): void {
    prisma.user
        .update({
            where: { id: userId },
            data: { lastActivity: new Date() },
        })
        .catch((error: unknown) => {
            logger.error(
                `Failed to update lastActivity for user ${userId}:`,
                error,
            );
        });
}
