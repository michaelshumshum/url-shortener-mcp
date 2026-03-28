import { env } from "../lib/env";
import { prisma } from "../lib/prisma";

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
 *
 */
export function updateUserActivity(userId: string): void {
    prisma.user
        .update({
            where: { id: userId },
            data: { lastActivity: new Date() },
        })
        .then()
        .catch((error) => {
            console.error(
                `Failed to update lastActivity for user ${userId}:`,
                error,
            );
        });
}
