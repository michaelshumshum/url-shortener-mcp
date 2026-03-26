import { randomBytes } from "node:crypto";
import supertest from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { generateSalt, hashKey } from "../src/lib/crypto";
import { prisma } from "./setup";

const request = supertest(app);

let apiKey: string;
let userId: string;
let apiKey2: string;
let userId2: string;

beforeAll(async () => {
    const rawKey1 = randomBytes(32).toString("hex");
    const salt1 = generateSalt();
    const user1 = await prisma.user.create({
        data: { key: hashKey(rawKey1, salt1), salt: salt1 },
    });
    apiKey = rawKey1;
    userId = user1.id;

    const rawKey2 = randomBytes(32).toString("hex");
    const salt2 = generateSalt();
    const user2 = await prisma.user.create({
        data: { key: hashKey(rawKey2, salt2), salt: salt2 },
    });
    apiKey2 = rawKey2;
    userId2 = user2.id;
});

afterEach(async () => {
    await prisma.url.deleteMany({
        where: { userId: { in: [userId, userId2] } },
    });
});

afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, userId2] } } });
});

const auth1 = () => `Bearer ${apiKey}`;
const auth2 = () => `Bearer ${apiKey2}`;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("auth", () => {
    it("returns 401 with no authorization header", async () => {
        const res = await request.get("/urls");
        expect(res.status).toBe(401);
    });

    it("returns 401 with wrong scheme", async () => {
        const res = await request
            .get("/urls")
            .set("Authorization", `Basic ${apiKey}`);
        expect(res.status).toBe(401);
    });

    it("returns 401 with invalid api key", async () => {
        const res = await request
            .get("/urls")
            .set("Authorization", "Bearer invalid-key");
        expect(res.status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// POST /urls
// ---------------------------------------------------------------------------

describe("POST /urls", () => {
    it("creates a shortened URL", async () => {
        const res = await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://example.com" });

        expect(res.status).toBe(201);
        expect(res.body.slug).toBeDefined();
        expect(res.body.longUrl).toBe("https://example.com");
        expect(res.body.shortUrl).toMatch(/^http:\/\//);
    });

    it("creates a URL with a custom slug", async () => {
        const res = await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://example.com", slug: "my-slug" });

        expect(res.status).toBe(201);
        expect(res.body.slug).toBe("my-slug");
    });

    it("creates a URL with a ttl", async () => {
        const res = await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://example.com", ttl: 3600 });

        expect(res.status).toBe(201);
        expect(res.body.expiresAt).toBeDefined();
    });

    it("creates a URL with an expiresAt", async () => {
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
        const res = await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://example.com", expiresAt });

        expect(res.status).toBe(201);
        expect(res.body.expiresAt).toBeDefined();
    });

    it("returns 400 when longUrl is missing", async () => {
        const res = await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({});

        expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid URL", async () => {
        const res = await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "not-a-url" });

        expect(res.status).toBe(400);
    });

    it("returns 400 when both ttl and expiresAt are provided", async () => {
        const res = await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({
                longUrl: "https://example.com",
                ttl: 3600,
                expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
            });

        expect(res.status).toBe(400);
    });

    it("returns 400 for a duplicate slug", async () => {
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://example.com", slug: "dup" });

        const res = await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://other.com", slug: "dup" });

        expect(res.status).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// GET /urls
// ---------------------------------------------------------------------------

describe("GET /urls", () => {
    it("returns all URLs owned by the user", async () => {
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://a.com" });
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://b.com" });

        const res = await request.get("/urls").set("Authorization", auth1());

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });

    it("does not return other users' URLs", async () => {
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://a.com" });
        await request
            .post("/urls")
            .set("Authorization", auth2())
            .send({ longUrl: "https://b.com" });

        const res = await request.get("/urls").set("Authorization", auth1());

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].longUrl).toBe("https://a.com");
    });

    it("supports orderBy and order query params", async () => {
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://a.com" });
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://b.com" });

        const res = await request
            .get("/urls?orderBy=createdAt&order=asc")
            .set("Authorization", auth1());

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });

    it("returns 400 for an invalid order value", async () => {
        const res = await request
            .get("/urls?order=invalid")
            .set("Authorization", auth1());

        expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid orderBy value", async () => {
        const res = await request
            .get("/urls?orderBy=unknown")
            .set("Authorization", auth1());

        expect(res.status).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// GET /urls/:slug
// ---------------------------------------------------------------------------

describe("GET /urls/:slug", () => {
    it("returns URL details for own slug", async () => {
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://example.com", slug: "get-test" });

        const res = await request
            .get("/urls/get-test")
            .set("Authorization", auth1());

        expect(res.status).toBe(200);
        expect(res.body.slug).toBe("get-test");
        expect(res.body.longUrl).toBe("https://example.com");
        expect(res.body.clicks).toBe(0);
    });

    it("returns 404 for an unknown slug", async () => {
        const res = await request
            .get("/urls/no-such-slug")
            .set("Authorization", auth1());

        expect(res.status).toBe(404);
    });

    it("returns 403 for another user's slug", async () => {
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://example.com", slug: "user1-url" });

        const res = await request
            .get("/urls/user1-url")
            .set("Authorization", auth2());

        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// DELETE /urls/:slug
// ---------------------------------------------------------------------------

describe("DELETE /urls/:slug", () => {
    it("deletes a URL and returns it", async () => {
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://example.com", slug: "del-test" });

        const res = await request
            .delete("/urls/del-test")
            .set("Authorization", auth1());

        expect(res.status).toBe(200);
        expect(res.body.slug).toBe("del-test");
        expect(res.body.longUrl).toBe("https://example.com");
    });

    it("returns 404 for an unknown slug", async () => {
        const res = await request
            .delete("/urls/no-such-slug")
            .set("Authorization", auth1());

        expect(res.status).toBe(404);
    });

    it("returns 403 for another user's slug", async () => {
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://example.com", slug: "user1-del" });

        const res = await request
            .delete("/urls/user1-del")
            .set("Authorization", auth2());

        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// DELETE /urls
// ---------------------------------------------------------------------------

describe("DELETE /urls", () => {
    it("deletes all URLs for the authenticated user", async () => {
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://a.com" });
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://b.com" });
        await request
            .post("/urls")
            .set("Authorization", auth2())
            .send({ longUrl: "https://c.com" });

        const res = await request.delete("/urls").set("Authorization", auth1());

        expect(res.status).toBe(200);
        expect(res.body.deleted).toBe(2);

        // Other user's URL is untouched
        const remaining = await request
            .get("/urls")
            .set("Authorization", auth2());
        expect(remaining.body).toHaveLength(1);
    });

    it("returns 0 when there are no URLs to delete", async () => {
        const res = await request.delete("/urls").set("Authorization", auth1());

        expect(res.status).toBe(200);
        expect(res.body.deleted).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// POST /urls/bulk
// ---------------------------------------------------------------------------

describe("POST /urls/bulk", () => {
    it("shortens multiple URLs and returns 207", async () => {
        const res = await request
            .post("/urls/bulk")
            .set("Authorization", auth1())
            .send({
                urls: [
                    { longUrl: "https://alpha.com" },
                    { longUrl: "https://beta.com" },
                ],
            });

        expect(res.status).toBe(207);
        expect(res.body).toHaveLength(2);
        expect(res.body[0].success).toBe(true);
        expect(res.body[0].data.longUrl).toBe("https://alpha.com");
        expect(res.body[0].data.shortUrl).toMatch(/^http:\/\//);
        expect(res.body[1].success).toBe(true);
        expect(res.body[1].data.longUrl).toBe("https://beta.com");
    });

    it("supports custom slugs per item", async () => {
        const res = await request
            .post("/urls/bulk")
            .set("Authorization", auth1())
            .send({
                urls: [
                    { longUrl: "https://example.com", slug: "bulk-a" },
                    { longUrl: "https://example.com", slug: "bulk-b" },
                ],
            });

        expect(res.status).toBe(207);
        expect(res.body[0].data.slug).toBe("bulk-a");
        expect(res.body[1].data.slug).toBe("bulk-b");
    });

    it("supports ttl per item", async () => {
        const res = await request
            .post("/urls/bulk")
            .set("Authorization", auth1())
            .send({
                urls: [{ longUrl: "https://example.com", ttl: 3600 }],
            });

        expect(res.status).toBe(207);
        expect(res.body[0].data.expiresAt).toBeDefined();
    });

    it("returns per-item errors for partial failures without failing the whole batch", async () => {
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://example.com", slug: "taken-slug" });

        const res = await request
            .post("/urls/bulk")
            .set("Authorization", auth1())
            .send({
                urls: [
                    { longUrl: "https://good.com" },
                    { longUrl: "https://bad.com", slug: "taken-slug" },
                ],
            });

        expect(res.status).toBe(207);
        expect(res.body[0].success).toBe(true);
        expect(res.body[1].success).toBe(false);
        expect(res.body[1].error).toBeDefined();
    });

    it("returns 400 when urls array is empty", async () => {
        const res = await request
            .post("/urls/bulk")
            .set("Authorization", auth1())
            .send({ urls: [] });

        expect(res.status).toBe(400);
    });

    it("returns 400 when urls array exceeds 20 items", async () => {
        const res = await request
            .post("/urls/bulk")
            .set("Authorization", auth1())
            .send({
                urls: Array.from({ length: 21 }, (_, i) => ({
                    longUrl: `https://example.com/${i}`,
                })),
            });

        expect(res.status).toBe(400);
    });

    it("returns 400 when an item has an invalid longUrl", async () => {
        const res = await request
            .post("/urls/bulk")
            .set("Authorization", auth1())
            .send({ urls: [{ longUrl: "not-a-url" }] });

        expect(res.status).toBe(400);
    });

    it("returns 401 without auth", async () => {
        const res = await request
            .post("/urls/bulk")
            .send({ urls: [{ longUrl: "https://example.com" }] });

        expect(res.status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// GET /:slug (redirect)
// ---------------------------------------------------------------------------

describe("GET /:slug", () => {
    it("redirects to the long URL", async () => {
        await request
            .post("/urls")
            .set("Authorization", auth1())
            .send({ longUrl: "https://example.com", slug: "redir-test" });

        const res = await request.get("/redir-test");

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("https://example.com");
    });

    it("returns 404 for an unknown slug", async () => {
        const res = await request.get("/no-such-slug");
        expect(res.status).toBe(404);
    });
});
