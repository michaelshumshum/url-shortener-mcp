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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a response that may be JSON or SSE (text/event-stream).
 * Returns the parsed JSON-RPC body.
 */
function parseMcpBody(res: supertest.Response): Record<string, unknown> | null {
    const ct = (res.headers["content-type"] as string) ?? "";
    if (ct.includes("text/event-stream")) {
        for (const line of (res.text ?? "").split("\n")) {
            if (line.startsWith("data: ")) {
                return JSON.parse(line.slice(6)) as Record<string, unknown>;
            }
        }
        return null;
    }
    return res.body as Record<string, unknown>;
}

/**
 * Create an MCP session for a given API key.
 * Returns the session ID from the response header.
 */
async function createSession(key: string): Promise<string> {
    const res = await request
        .post("/mcp")
        .set("Authorization", `Bearer ${key}`)
        .set("Accept", "application/json, text/event-stream")
        .send({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "test-client", version: "1.0.0" },
            },
        });

    expect(res.status).toBe(200);
    const sessionId = res.headers["mcp-session-id"] as string;
    expect(sessionId).toBeDefined();

    // Acknowledge initialization
    await request
        .post("/mcp")
        .set("Authorization", `Bearer ${key}`)
        .set("Accept", "application/json, text/event-stream")
        .set("mcp-session-id", sessionId)
        .send({ jsonrpc: "2.0", method: "notifications/initialized" });

    return sessionId;
}

/**
 * Call an MCP tool and return the text content of the first result item.
 */
async function callTool(
    sessionId: string,
    key: string,
    name: string,
    args: Record<string, unknown> = {},
): Promise<{ text: string; isError?: boolean }> {
    const res = await request
        .post("/mcp")
        .set("Authorization", `Bearer ${key}`)
        .set("Accept", "application/json, text/event-stream")
        .set("mcp-session-id", sessionId)
        .send({
            jsonrpc: "2.0",
            id: Math.floor(Math.random() * 100_000),
            method: "tools/call",
            params: { name, arguments: args },
        });

    const body = parseMcpBody(res);
    const result = body?.result as
        | { content: { type: string; text: string }[]; isError?: boolean }
        | undefined;
    const text = result?.content?.[0]?.text ?? "";
    return { text, isError: result?.isError };
}

/**
 * Call a tool and parse the returned JSON text.
 */
async function callToolJson<T>(
    sessionId: string,
    key: string,
    name: string,
    args: Record<string, unknown> = {},
): Promise<T> {
    const { text } = await callTool(sessionId, key, name, args);
    return JSON.parse(text) as T;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

describe("session management", () => {
    it("creates a session on initialize", async () => {
        const res = await request
            .post("/mcp")
            .set("Authorization", `Bearer ${apiKey}`)
            .set("Accept", "application/json, text/event-stream")
            .send({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: "2024-11-05",
                    capabilities: {},
                    clientInfo: { name: "test", version: "1.0.0" },
                },
            });

        expect(res.status).toBe(200);
        expect(res.headers["mcp-session-id"]).toBeDefined();

        const body = parseMcpBody(res);
        expect(body?.id).toBe(1);

        const result = body?.result as Record<string, unknown>;
        expect(result?.serverInfo).toBeDefined();

        // Cleanup
        const sessionId = res.headers["mcp-session-id"] as string;
        await request
            .delete("/mcp")
            .set("Authorization", `Bearer ${apiKey}`)
            .set("mcp-session-id", sessionId);
    });

    it("returns 401 without an authorization header", async () => {
        const res = await request.post("/mcp").send({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "test", version: "1.0.0" },
            },
        });

        expect(res.status).toBe(401);
    });

    it("returns 404 for an unknown session ID", async () => {
        const res = await request
            .post("/mcp")
            .set("Authorization", `Bearer ${apiKey}`)
            .set("Accept", "application/json, text/event-stream")
            .set("mcp-session-id", "nonexistent-session-id")
            .send({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list",
                params: {},
            });

        expect(res.status).toBe(404);
    });

    it("deletes a session", async () => {
        const sessionId = await createSession(apiKey);

        const deleteRes = await request
            .delete("/mcp")
            .set("Authorization", `Bearer ${apiKey}`)
            .set("mcp-session-id", sessionId);

        expect(deleteRes.status).toBe(204);

        // Session is gone
        const followUp = await request
            .post("/mcp")
            .set("Authorization", `Bearer ${apiKey}`)
            .set("Accept", "application/json, text/event-stream")
            .set("mcp-session-id", sessionId)
            .send({
                jsonrpc: "2.0",
                id: 3,
                method: "tools/list",
                params: {},
            });

        expect(followUp.status).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// shorten_url
// ---------------------------------------------------------------------------

describe("shorten_url", () => {
    let sessionId: string;

    beforeAll(async () => {
        sessionId = await createSession(apiKey);
    });

    afterAll(async () => {
        await request
            .delete("/mcp")
            .set("Authorization", `Bearer ${apiKey}`)
            .set("mcp-session-id", sessionId);
    });

    it("creates a shortened URL and returns only the short URL", async () => {
        const { text } = await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://example.com",
        });

        expect(text).toMatch(/^http:\/\//);
    });

    it("creates a URL with a custom slug and returns the short URL", async () => {
        const { text } = await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://example.com",
            slug: "mcp-slug",
        });

        expect(text).toMatch(/\/mcp-slug$/);
    });

    it("creates a URL with a ttl", async () => {
        const { text } = await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://example.com",
            slug: "mcp-ttl",
            ttl: 3600,
        });

        expect(text).toMatch(/^http:\/\//);

        const url = await callToolJson<{ expiresAt: string | null }>(
            sessionId,
            apiKey,
            "get_url",
            { slug: "mcp-ttl" },
        );
        expect(url.expiresAt).toBeDefined();
    });

    it("returns an error for an invalid URL", async () => {
        const { isError } = await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "not-a-url",
        });

        expect(isError).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// get_url
// ---------------------------------------------------------------------------

describe("get_url", () => {
    let sessionId: string;
    let sessionId2: string;

    beforeAll(async () => {
        sessionId = await createSession(apiKey);
        sessionId2 = await createSession(apiKey2);
    });

    afterAll(async () => {
        await request
            .delete("/mcp")
            .set("Authorization", `Bearer ${apiKey}`)
            .set("mcp-session-id", sessionId);
        await request
            .delete("/mcp")
            .set("Authorization", `Bearer ${apiKey2}`)
            .set("mcp-session-id", sessionId2);
    });

    it("returns URL details", async () => {
        await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://example.com",
            slug: "get-mcp",
        });

        const url = await callToolJson<{ slug: string; clicks: number }>(
            sessionId,
            apiKey,
            "get_url",
            { slug: "get-mcp" },
        );

        expect(url.slug).toBe("get-mcp");
        expect(url.clicks).toBe(0);
    });

    it("returns an error for an unknown slug", async () => {
        const { isError } = await callTool(sessionId, apiKey, "get_url", {
            slug: "no-such-slug",
        });

        expect(isError).toBe(true);
    });

    it("returns an error for another user's slug", async () => {
        await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://example.com",
            slug: "user1-mcp",
        });

        const { isError } = await callTool(sessionId2, apiKey2, "get_url", {
            slug: "user1-mcp",
        });

        expect(isError).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// list_urls
// ---------------------------------------------------------------------------

describe("list_urls", () => {
    let sessionId: string;

    beforeAll(async () => {
        sessionId = await createSession(apiKey);
    });

    afterAll(async () => {
        await request
            .delete("/mcp")
            .set("Authorization", `Bearer ${apiKey}`)
            .set("mcp-session-id", sessionId);
    });

    it("returns all owned URLs", async () => {
        await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://a.com",
        });
        await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://b.com",
        });

        const urls = await callToolJson<unknown[]>(
            sessionId,
            apiKey,
            "list_urls",
        );

        expect(urls).toHaveLength(2);
    });

    it("supports orderBy and order arguments", async () => {
        await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://a.com",
        });
        await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://b.com",
        });

        const urls = await callToolJson<{ longUrl: string }[]>(
            sessionId,
            apiKey,
            "list_urls",
            { orderBy: "createdAt", order: "asc" },
        );

        expect(urls.length).toBeGreaterThanOrEqual(2);
    });
});

// ---------------------------------------------------------------------------
// delete_url
// ---------------------------------------------------------------------------

describe("delete_url", () => {
    let sessionId: string;
    let sessionId2: string;

    beforeAll(async () => {
        sessionId = await createSession(apiKey);
        sessionId2 = await createSession(apiKey2);
    });

    afterAll(async () => {
        await request
            .delete("/mcp")
            .set("Authorization", `Bearer ${apiKey}`)
            .set("mcp-session-id", sessionId);
        await request
            .delete("/mcp")
            .set("Authorization", `Bearer ${apiKey2}`)
            .set("mcp-session-id", sessionId2);
    });

    it("deletes a URL and returns confirmation", async () => {
        await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://example.com",
            slug: "del-mcp",
        });

        const { text, isError } = await callTool(
            sessionId,
            apiKey,
            "delete_url",
            {
                slug: "del-mcp",
            },
        );

        expect(isError).toBeUndefined();
        expect(text).toContain("Deleted successfully");
    });

    it("returns an error for an unknown slug", async () => {
        const { isError } = await callTool(sessionId, apiKey, "delete_url", {
            slug: "no-such-slug",
        });

        expect(isError).toBe(true);
    });

    it("returns an error for another user's slug", async () => {
        await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://example.com",
            slug: "user1-del-mcp",
        });

        const { isError } = await callTool(sessionId2, apiKey2, "delete_url", {
            slug: "user1-del-mcp",
        });

        expect(isError).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// bulk_shorten_urls
// ---------------------------------------------------------------------------

describe("bulk_shorten_urls", () => {
    let sessionId: string;

    beforeAll(async () => {
        sessionId = await createSession(apiKey);
    });

    afterAll(async () => {
        await request
            .delete("/mcp")
            .set("Authorization", `Bearer ${apiKey}`)
            .set("mcp-session-id", sessionId);
    });

    it("shortens multiple URLs and returns per-item results", async () => {
        const results = await callToolJson<
            { longUrl: string; success: boolean; data: { shortUrl: string } }[]
        >(sessionId, apiKey, "bulk_shorten_urls", {
            urls: [
                { longUrl: "https://alpha.com" },
                { longUrl: "https://beta.com" },
            ],
        });

        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
        expect(results[0].data.shortUrl).toMatch(/^http:\/\//);
        expect(results[1].success).toBe(true);
    });

    it("reports per-item failures for duplicate slugs without failing the batch", async () => {
        await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://example.com",
            slug: "bulk-mcp-taken",
        });

        const results = await callToolJson<
            { success: boolean; error?: string }[]
        >(sessionId, apiKey, "bulk_shorten_urls", {
            urls: [
                { longUrl: "https://good.com" },
                { longUrl: "https://bad.com", slug: "bulk-mcp-taken" },
            ],
        });

        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(false);
        expect(results[1].error).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// delete_all_urls
// ---------------------------------------------------------------------------

describe("delete_all_urls", () => {
    let sessionId: string;
    let sessionId2: string;

    beforeAll(async () => {
        sessionId = await createSession(apiKey);
        sessionId2 = await createSession(apiKey2);
    });

    afterAll(async () => {
        await request
            .delete("/mcp")
            .set("Authorization", `Bearer ${apiKey}`)
            .set("mcp-session-id", sessionId);
        await request
            .delete("/mcp")
            .set("Authorization", `Bearer ${apiKey2}`)
            .set("mcp-session-id", sessionId2);
    });

    it("deletes all owned URLs", async () => {
        await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://a.com",
        });
        await callTool(sessionId, apiKey, "shorten_url", {
            longUrl: "https://b.com",
        });
        await callTool(sessionId2, apiKey2, "shorten_url", {
            longUrl: "https://c.com",
        });

        const { text, isError } = await callTool(
            sessionId,
            apiKey,
            "delete_all_urls",
        );

        expect(isError).toBeUndefined();
        expect(text).toContain("Deleted 2");

        // Other user's URLs are untouched
        const remaining = await callToolJson<unknown[]>(
            sessionId2,
            apiKey2,
            "list_urls",
        );
        expect(remaining).toHaveLength(1);
    });

    it("reports 0 when there are no URLs to delete", async () => {
        const { text } = await callTool(sessionId, apiKey, "delete_all_urls");
        expect(text).toContain("Deleted 0");
    });
});
