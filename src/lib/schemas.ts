import { z } from "zod";

/**
 * Schema for creating a new shortened URL
 * Validates longUrl format, ttl/expiresAt constraints, and ensures mutual exclusivity
 */
export const createUrlSchema = z
    .object({
        longUrl: z
            .url("Must be a valid URL")
            .refine((url) => /^https?:\/\//i.test(url), {
                message: "Only http and https URLs are allowed",
            }),
        ttl: z.number().int().positive().optional(),
        expiresAt: z.iso.datetime().optional(),
        slug: z.string().min(1).max(32).optional(),
        tag: z
            .string()
            .min(1)
            .max(128)
            .optional()
            .describe(
                "A short note describing this URL's purpose (e.g. 'auth API reference', 'PR #42'). Used to retrieve URLs later via search_urls without keeping that context in the conversation.",
            ),
    })
    .refine((data) => !(data.ttl && data.expiresAt), {
        message: "Cannot specify both ttl and expiresAt",
    })
    .refine(
        (data) => {
            if (data.expiresAt) {
                const date = new Date(data.expiresAt);
                return date > new Date();
            }
            return true;
        },
        { message: "expiresAt must be in the future" },
    );

export const bulkCreateUrlSchema = z.object({
    urls: z.array(createUrlSchema).min(1).max(20),
});

export const listUrlsSchema = z.object({
    orderBy: z.enum(["createdAt", "expiresAt", "clicks"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
});

export const searchUrlsSchema = z.object({
    tag: z
        .string()
        .min(1)
        .max(128)
        .optional()
        .describe("Substring to match within the tag"),
    longUrl: z
        .string()
        .min(1)
        .optional()
        .describe("Substring to match within the long URL"),
});

/**
 * Schema for validating slug path parameters
 */
export const slugParamSchema = z.object({
    slug: z.string().min(1).max(32),
});

export type CreateUrlInput = z.infer<typeof createUrlSchema>;
