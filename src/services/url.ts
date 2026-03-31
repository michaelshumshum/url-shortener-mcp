import type { Url } from "../../generated/prisma/client";
import {
    ExpiryTooLargeError,
    ForbiddenError,
    NotFoundError,
} from "../lib/errors";
import { prisma } from "../lib/prisma";
import { isExpired, resolveExpiry } from "./expiry";
import { generateSlug, shortUrl, validateSlug } from "./slug";
import { updateUserActivity } from "./user";

export { ExpiryTooLargeError, ForbiddenError, NotFoundError };

export type CreateUrlInput = {
    longUrl: string;
    userId: string;
    ttl?: number;
    expiresAt?: Date;
    slug?: string;
    tag?: string;
};

/**
 * Estimates tokens saved per substitution using the ~4 chars/token heuristic.
 * This is a per-use delta only — it does not account for the token cost of
 * the shorten_url call itself (which echoes longUrl in both input and output).
 * Net savings only accumulate when the slug is reused multiple times.
 */
function computeTokensSaved(longUrl: string, slug: string): number {
    return Math.max(
        0,
        Math.round(longUrl.length / 4) - Math.round(slug.length / 4),
    );
}

/**
 * Creates a new shortened URL with optional expiry
 * @param input - The URL creation parameters
 * @returns The created URL record
 * @throws {ExpiryTooLargeError} If the expiry exceeds MAX_EXPIRY_SECONDS
 * @throws {Error} If unable to generate unique slug after retries
 */
export async function createUrl(
    input: CreateUrlInput,
): Promise<Url & { shortUrl: string }> {
    const slug = input.slug !== undefined ? input.slug : generateSlug();
    await validateSlug(slug);
    const expiresAt = resolveExpiry(input);
    const estimatedTokensSaved = computeTokensSaved(input.longUrl, slug);

    const url = await prisma.url.create({
        data: {
            slug,
            longUrl: input.longUrl,
            userId: input.userId,
            expiresAt,
            estimatedTokensSaved,
            tag: input.tag ?? null,
        },
    });

    updateUserActivity(input.userId);

    return {
        ...url,
        shortUrl: shortUrl(url),
    };
}

/**
 * Resolves a slug to its URL and increments the click counter
 * Deletes the URL if it has expired
 * @param slug - The short slug to resolve
 * @returns The URL record or null if not found or expired
 */
export async function resolveUrl(slug: string): Promise<string | null> {
    const url = await prisma.url.findUnique({ where: { slug } });
    if (!url) return null;

    if (isExpired(url)) {
        await prisma.url.delete({ where: { slug } });
        return null;
    }

    const updatedUrl = await prisma.url.update({
        where: { slug },
        data: { clicks: { increment: 1 } },
    });
    return updatedUrl.longUrl;
}

/**
 * Lists all non-expired URLs for a user
 * @param userId - The user ID to filter by
 * @returns Array of URL records ordered by creation date (newest first)
 */
export async function listUrls(
    userId: string,
    orderBy: "createdAt" | "expiresAt" | "clicks" = "createdAt",
    order: "asc" | "desc" = "desc",
): Promise<(Url & { shortUrl: string })[]> {
    const urls = await prisma.url.findMany({
        where: {
            userId,
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
        orderBy: {
            [orderBy]: order,
        },
    });

    return urls.map((url) => ({
        ...url,
        shortUrl: shortUrl(url),
    }));
}

export async function deleteAllUrls(userId: string): Promise<number> {
    const { count } = await prisma.url.deleteMany({ where: { userId } });
    return count;
}

/**
 * Gets a single URL by slug with ownership verification
 * Deletes the URL if it has expired
 * @param slug - The short slug to look up
 * @param userId - The user ID for ownership verification
 * @returns The URL record
 * @throws {NotFoundError} If URL not found or expired
 * @throws {ForbiddenError} If user doesn't own the URL
 */
export async function getUrl(
    slug: string,
    userId: string,
): Promise<Url & { shortUrl: string }> {
    const url = await prisma.url.findUnique({ where: { slug } });

    if (!url) throw new NotFoundError();

    if (isExpired(url)) {
        await prisma.url.delete({ where: { slug } });
        throw new NotFoundError();
    }

    if (url.userId !== userId) throw new ForbiddenError();

    return {
        ...url,
        shortUrl: shortUrl(url),
    };
}

/**
 * Deletes a URL by slug with ownership verification
 * @param slug - The short slug to delete
 * @param userId - The user ID for ownership verification
 * @throws {NotFoundError} If URL not found
 * @throws {ForbiddenError} If user doesn't own the URL
 */
export async function deleteUrl(slug: string, userId: string): Promise<void> {
    const url = await prisma.url.findUnique({ where: { slug } });

    if (!url) throw new NotFoundError();
    if (url.userId !== userId) throw new ForbiddenError();

    await prisma.url.delete({ where: { slug } });
}

export type UrlSearchResult = {
    slug: string;
    shortUrl: string;
    longUrl: string;
    tag: string | null;
    expiresAt: Date | null;
};

/**
 * Searches non-expired URLs for a user by tag substring and/or longUrl substring.
 * Returns a minimal payload to keep context cost low.
 * Note: substring matching is case-sensitive (SQLite LIKE behaviour).
 * @param userId - The user ID to scope results to
 * @param input - At least one of tag or longUrl must be provided
 */
export async function searchUrls(
    userId: string,
    input: { tag?: string; longUrl?: string },
): Promise<UrlSearchResult[]> {
    const urls = await prisma.url.findMany({
        where: {
            userId,
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
            ...(input.tag !== undefined
                ? { tag: { contains: input.tag } }
                : {}),
            ...(input.longUrl !== undefined
                ? { longUrl: { contains: input.longUrl } }
                : {}),
        },
        select: {
            slug: true,
            longUrl: true,
            tag: true,
            expiresAt: true,
        },
    });

    return urls.map((url) => ({
        ...url,
        shortUrl: shortUrl(url),
    }));
}

/**
 * Deletes all expired URLs (used by background cron job)
 * @returns The number of deleted URLs
 */
export async function deleteExpiredUrls(): Promise<number> {
    const result = await prisma.url.deleteMany({
        where: {
            expiresAt: {
                lt: new Date(),
            },
        },
    });
    return result.count;
}
