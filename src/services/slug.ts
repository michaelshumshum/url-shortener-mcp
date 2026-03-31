import { randomBytes } from "node:crypto";
import { env } from "../lib/env";
import { AlreadyExistsError, ValidationError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { Routes } from "../lib/routes";

/**
 * Generates a cryptographically secure random slug
 * @param length - The desired length of the slug (default: 8)
 * @returns A random slug using base64url encoding
 */
export function generateSlug(length = 8): string {
    return randomBytes(Math.ceil(length * 0.75))
        .toString("base64url")
        .slice(0, length);
}

/**
 * Generates the full short URL for a given URL record
 * @param url - The URL record
 * @returns The full short URL
 */
export function shortUrl(url: { slug: string }): string {
    return `${env.HTTPS ? "https" : "http"}://${env.HOSTNAME}/${url.slug}`;
}

const RESERVED_SLUGS = new Set([
    ...Routes.list(),
    ...Routes.list().map((r) => r.toUpperCase()),
]);

const SLUG_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Ensures a unique slug is generated and does not use a reserved slug. If a slug is provided, it checks for uniqueness; if not, it generates a random slug and checks for collisions.
 * @param slug - Slug to check
 * @param maxRetries - Maximum number of retry attempts (default: 10)
 * @returns A unique slug
 * @throws {Error} If unable to generate unique slug after max retries
 */
export async function validateSlug(slug: string): Promise<string> {
    if (slug.length === 0) {
        throw new ValidationError("Slug cannot be empty");
    }

    if (!SLUG_REGEX.test(slug)) {
        throw new ValidationError(
            "Slug can only contain letters, numbers, underscores, and hyphens",
        );
    }

    // Check if any of the reserved slugs include the provided slug (case-insensitive)
    if (RESERVED_SLUGS.has(`/${slug}`)) {
        throw new ValidationError(`Slug "${slug}" is reserved`);
    }

    const existing = await prisma.url.findUnique({
        where: { slug },
    });
    if (!existing) return slug;
    throw new AlreadyExistsError(
        slug
            ? `Slug "${slug}" already exists`
            : "Generated slug collision, please try again",
    );
}
