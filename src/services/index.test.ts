import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../tests/setup";
import { generateSalt, hashKey } from "../lib/crypto";
import {
    AlreadyExistsError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
} from "../lib/errors";
import {
    createUrl,
    deleteAllUrls,
    deleteExpiredUrls,
    deleteUrl,
    getUrl,
    listUrls,
    resolveUrl,
} from "./url";
import { deleteInactiveUsers } from "./user";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(lastActivity?: Date) {
    const rawKey = randomBytes(32).toString("hex");
    const salt = generateSalt();
    return prisma.user.create({
        data: {
            key: hashKey(rawKey, salt),
            salt,
            ...(lastActivity && { lastActivity }),
        },
    });
}

function randomSlug() {
    return `t-${randomBytes(4).toString("hex")}`;
}

const OLD_DATE = new Date(Date.now() - 999_999_999);
const FUTURE = new Date(Date.now() + 86400 * 1000);
const PAST = new Date(Date.now() - 1000);

// ---------------------------------------------------------------------------
// createUrl
// ---------------------------------------------------------------------------

describe("createUrl", () => {
    let userId: string;

    beforeAll(async () => {
        const user = await createUser();
        userId = user.id;
    });

    afterAll(async () => {
        await prisma.url.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
    });

    it("creates a URL and returns it with a shortUrl", async () => {
        const result = await createUrl({
            longUrl: "https://example.com",
            userId,
        });

        expect(result.longUrl).toBe("https://example.com");
        expect(result.userId).toBe(userId);
        expect(result.slug).toBeDefined();
        expect(result.shortUrl).toMatch(/^https?:\/\//);
    });

    it("uses a custom slug when provided", async () => {
        const slug = randomSlug();

        const result = await createUrl({
            longUrl: "https://example.com",
            userId,
            slug,
        });

        expect(result.slug).toBe(slug);
    });

    it("throws ValidationError for an empty slug", async () => {
        await expect(
            createUrl({ longUrl: "https://example.com", userId, slug: "" }),
        ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for a reserved slug", async () => {
        await expect(
            createUrl({ longUrl: "https://example.com", userId, slug: "mcp" }),
        ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for an invalid slug", async () => {
        await expect(
            createUrl({
                longUrl: "https://example.com",
                userId,
                slug: "invalid slug//",
            }),
        ).rejects.toThrow(ValidationError);
    });

    it("throws AlreadyExistsError for a duplicate slug", async () => {
        const slug = randomSlug();

        await createUrl({ longUrl: "https://example.com", userId, slug });

        await expect(
            createUrl({ longUrl: "https://other.com", userId, slug }),
        ).rejects.toThrow(AlreadyExistsError);
    });

    it("sets expiresAt from ttl", async () => {
        const before = Date.now();
        const result = await createUrl({
            longUrl: "https://example.com",
            userId,
            ttl: 3600,
        });
        const after = Date.now();

        const exp = result.expiresAt!.getTime();
        expect(exp).toBeGreaterThanOrEqual(before + 3600 * 1000 - 50);
        expect(exp).toBeLessThanOrEqual(after + 3600 * 1000 + 50);
    });

    it("sets expiresAt from explicit expiresAt", async () => {
        const user = await createUser();
        userId = user.id;
        const expiresAt = new Date(Date.now() + 7200 * 1000);

        const result = await createUrl({
            longUrl: "https://example.com",
            userId,
            expiresAt,
        });

        expect(result.expiresAt?.toISOString()).toBe(expiresAt.toISOString());
    });
});

// ---------------------------------------------------------------------------
// resolveUrl
// ---------------------------------------------------------------------------

describe("resolveUrl", () => {
    let userId: string;

    afterEach(async () => {
        await prisma.url.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
    });

    it("returns the long URL and increments clicks", async () => {
        const user = await createUser();
        userId = user.id;
        const slug = randomSlug();
        await prisma.url.create({
            data: {
                slug,
                longUrl: "https://example.com",
                userId,
                expiresAt: FUTURE,
            },
        });

        const result = await resolveUrl(slug);

        expect(result).toBe("https://example.com");
        const row = await prisma.url.findUnique({ where: { slug } });
        expect(row?.clicks).toBe(1);
    });

    it("returns null for an unknown slug", async () => {
        const user = await createUser();
        userId = user.id;

        expect(await resolveUrl("no-such-slug")).toBeNull();
    });

    it("returns null and deletes the URL when expired", async () => {
        const user = await createUser();
        userId = user.id;
        const slug = randomSlug();
        await prisma.url.create({
            data: {
                slug,
                longUrl: "https://example.com",
                userId,
                expiresAt: PAST,
            },
        });

        const result = await resolveUrl(slug);

        expect(result).toBeNull();
        const row = await prisma.url.findUnique({ where: { slug } });
        expect(row).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// listUrls
// ---------------------------------------------------------------------------

describe("listUrls", () => {
    let userId: string;

    afterEach(async () => {
        await prisma.url.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
    });

    it("returns only non-expired URLs for the user", async () => {
        const user = await createUser();
        userId = user.id;
        await prisma.url.create({
            data: {
                slug: randomSlug(),
                longUrl: "https://active.com",
                userId,
                expiresAt: FUTURE,
            },
        });
        await prisma.url.create({
            data: {
                slug: randomSlug(),
                longUrl: "https://expired.com",
                userId,
                expiresAt: PAST,
            },
        });

        const results = await listUrls(userId);

        expect(results).toHaveLength(1);
        expect(results[0].longUrl).toBe("https://active.com");
    });

    it("includes a shortUrl on each result", async () => {
        const user = await createUser();
        userId = user.id;
        await prisma.url.create({
            data: {
                slug: randomSlug(),
                longUrl: "https://example.com",
                userId,
                expiresAt: FUTURE,
            },
        });

        const results = await listUrls(userId);

        expect(results[0].shortUrl).toMatch(/^https?:\/\//);
    });

    it("orders by createdAt desc by default", async () => {
        const user = await createUser();
        userId = user.id;
        await prisma.url.create({
            data: {
                slug: randomSlug(),
                longUrl: "https://first.com",
                userId,
                expiresAt: FUTURE,
                createdAt: new Date(Date.now() - 1000),
            },
        });
        await prisma.url.create({
            data: {
                slug: randomSlug(),
                longUrl: "https://second.com",
                userId,
                expiresAt: FUTURE,
                createdAt: new Date(),
            },
        });

        const results = await listUrls(userId);

        expect(results[0].longUrl).toBe("https://second.com");
        expect(results[1].longUrl).toBe("https://first.com");
    });

    it("returns empty array when user has no URLs", async () => {
        const user = await createUser();
        userId = user.id;

        expect(await listUrls(userId)).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// getUrl
// ---------------------------------------------------------------------------

describe("getUrl", () => {
    let userId: string;
    let userId2: string;

    afterEach(async () => {
        const ids = [userId, userId2].filter(Boolean);
        await prisma.url.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
        userId = userId2 = undefined!;
    });

    it("returns the URL with shortUrl for the owner", async () => {
        const user = await createUser();
        userId = user.id;
        const slug = randomSlug();
        await prisma.url.create({
            data: {
                slug,
                longUrl: "https://example.com",
                userId,
                expiresAt: FUTURE,
            },
        });

        const result = await getUrl(slug, userId);

        expect(result.slug).toBe(slug);
        expect(result.shortUrl).toMatch(/^https?:\/\//);
    });

    it("throws NotFoundError for an unknown slug", async () => {
        const user = await createUser();
        userId = user.id;

        await expect(getUrl("no-such-slug", userId)).rejects.toThrow(
            NotFoundError,
        );
    });

    it("throws NotFoundError and deletes the URL when expired", async () => {
        const user = await createUser();
        userId = user.id;
        const slug = randomSlug();
        await prisma.url.create({
            data: {
                slug,
                longUrl: "https://example.com",
                userId,
                expiresAt: PAST,
            },
        });

        await expect(getUrl(slug, userId)).rejects.toThrow(NotFoundError);
        expect(await prisma.url.findUnique({ where: { slug } })).toBeNull();
    });

    it("throws ForbiddenError when user does not own the URL", async () => {
        const user1 = await createUser();
        userId = user1.id;
        const user2 = await createUser();
        userId2 = user2.id;
        const slug = randomSlug();
        await prisma.url.create({
            data: {
                slug,
                longUrl: "https://example.com",
                userId,
                expiresAt: FUTURE,
            },
        });

        await expect(getUrl(slug, userId2)).rejects.toThrow(ForbiddenError);
    });
});

// ---------------------------------------------------------------------------
// deleteUrl
// ---------------------------------------------------------------------------

describe("deleteUrl", () => {
    let userId: string;
    let userId2: string;

    afterEach(async () => {
        const ids = [userId, userId2].filter(Boolean);
        await prisma.url.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
        userId = userId2 = undefined!;
    });

    it("returns the deleted URL record", async () => {
        const user = await createUser();
        userId = user.id;
        const slug = randomSlug();
        await prisma.url.create({
            data: {
                slug,
                longUrl: "https://example.com",
                userId,
                expiresAt: FUTURE,
            },
        });

        const result = await deleteUrl(slug, userId);

        expect(result.slug).toBe(slug);
        expect(result.shortUrl).toMatch(/^https?:\/\//);
    });

    it("throws NotFoundError for an unknown slug", async () => {
        const user = await createUser();
        userId = user.id;

        await expect(deleteUrl("no-such-slug", userId)).rejects.toThrow(
            NotFoundError,
        );
    });

    it("throws ForbiddenError when user does not own the URL", async () => {
        const user1 = await createUser();
        userId = user1.id;
        const user2 = await createUser();
        userId2 = user2.id;
        const slug = randomSlug();
        await prisma.url.create({
            data: {
                slug,
                longUrl: "https://example.com",
                userId,
                expiresAt: FUTURE,
            },
        });

        await expect(deleteUrl(slug, userId2)).rejects.toThrow(ForbiddenError);
    });
});

// ---------------------------------------------------------------------------
// deleteAllUrls
// ---------------------------------------------------------------------------

describe("deleteAllUrls", () => {
    let userId: string;

    afterEach(async () => {
        await prisma.url.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
    });

    it("deletes all URLs for the user and returns the count", async () => {
        const user = await createUser();
        userId = user.id;
        await prisma.url.createMany({
            data: [
                {
                    slug: randomSlug(),
                    longUrl: "https://a.com",
                    userId,
                    expiresAt: FUTURE,
                },
                {
                    slug: randomSlug(),
                    longUrl: "https://b.com",
                    userId,
                    expiresAt: FUTURE,
                },
            ],
        });

        const count = await deleteAllUrls(userId);

        expect(count).toBe(2);
        expect(await prisma.url.findMany({ where: { userId } })).toHaveLength(
            0,
        );
    });

    it("returns 0 when there are no URLs", async () => {
        const user = await createUser();
        userId = user.id;

        expect(await deleteAllUrls(userId)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// deleteExpiredUrls
// ---------------------------------------------------------------------------

describe("deleteExpiredUrls", () => {
    let userId: string;

    afterEach(async () => {
        await prisma.url.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
    });

    it("deletes only expired URLs and returns the count", async () => {
        const user = await createUser();
        userId = user.id;
        const activeSlug = randomSlug();
        await prisma.url.create({
            data: {
                slug: activeSlug,
                longUrl: "https://active.com",
                userId,
                expiresAt: FUTURE,
            },
        });
        await prisma.url.create({
            data: {
                slug: randomSlug(),
                longUrl: "https://expired.com",
                userId,
                expiresAt: PAST,
            },
        });

        const count = await deleteExpiredUrls();

        expect(count).toBeGreaterThanOrEqual(1);
        const remaining = await prisma.url.findMany({ where: { userId } });
        expect(remaining).toHaveLength(1);
        expect(remaining[0].slug).toBe(activeSlug);
    });

    it("returns 0 when there are no expired URLs", async () => {
        const user = await createUser();
        userId = user.id;
        await prisma.url.create({
            data: {
                slug: randomSlug(),
                longUrl: "https://active.com",
                userId,
                expiresAt: FUTURE,
            },
        });

        const count = await deleteExpiredUrls();

        expect(count).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// deleteInactiveUsers
// ---------------------------------------------------------------------------

describe("deleteInactiveUsers", () => {
    const createdUserIds: string[] = [];

    afterEach(async () => {
        await prisma.url.deleteMany({
            where: { userId: { in: createdUserIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
        createdUserIds.length = 0;
    });

    it("deletes inactive users with no URLs", async () => {
        const user = await createUser(OLD_DATE);
        createdUserIds.push(user.id);

        const count = await deleteInactiveUsers();

        expect(count).toBeGreaterThanOrEqual(1);
        expect(
            await prisma.user.findUnique({ where: { id: user.id } }),
        ).toBeNull();
        createdUserIds.splice(0);
    });

    it("does not delete inactive users who still have URLs", async () => {
        const user = await createUser(OLD_DATE);
        createdUserIds.push(user.id);
        await prisma.url.create({
            data: {
                slug: randomSlug(),
                longUrl: "https://example.com",
                userId: user.id,
                expiresAt: FUTURE,
            },
        });

        const count = await deleteInactiveUsers();

        expect(count).toBe(0);
        expect(
            await prisma.user.findUnique({ where: { id: user.id } }),
        ).not.toBeNull();
    });

    it("does not delete recently active users with no URLs", async () => {
        const user = await createUser(new Date());
        createdUserIds.push(user.id);

        const count = await deleteInactiveUsers();

        expect(count).toBe(0);
        expect(
            await prisma.user.findUnique({ where: { id: user.id } }),
        ).not.toBeNull();
    });
});
