import type { Url } from "../../generated/prisma/client";
import { env } from "../lib/env";
import { ExpiryTooLargeError } from "../lib/errors";

interface ResolveExpiryInput {
    ttl?: number; // Time to live in seconds
    expiresAt?: Date; // Absolute expiry date
}

/**
 * Resolves the expiry date from ttl or expiresAt input, enforcing the MAX_EXPIRY_SECONDS limit
 *
 * `expiresAt` takes precedence over `ttl` if both are provided. If neither is provided, defaults to MAX_EXPIRY_SECONDS from now.
 *
 * @param input Object containing optional `ttl` (seconds) and/or `expiresAt`.
 * @returns The calculated expiry date
 * @throws {ExpiryTooLargeError} If expiry exceeds MAX_EXPIRY_SECONDS
 */
export function resolveExpiry({ ttl, expiresAt }: ResolveExpiryInput): Date {
    const maxSeconds = env.MAX_EXPIRY_SECONDS;
    const maxDate = new Date(Date.now() + maxSeconds * 1000);

    if (expiresAt) {
        if (expiresAt > maxDate) {
            throw new ExpiryTooLargeError(maxSeconds);
        }
        return expiresAt;
    }

    if (ttl) {
        if (ttl > maxSeconds) {
            throw new ExpiryTooLargeError(maxSeconds);
        }
        return new Date(Date.now() + ttl * 1000);
    }

    // All URLs expire; cap at MAX_EXPIRY_SECONDS when no ttl/expiresAt is given
    return new Date(Date.now() + maxSeconds * 1000);
}

/**
 * Checks if a URL has expired
 * @param url - The URL record to check
 * @returns true if the URL has expired, false otherwise
 */
export function isExpired(url: Url): boolean {
    return url.expiresAt !== null && url.expiresAt < new Date();
}
