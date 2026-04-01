import { randomUUID } from "node:crypto";
import {
    McpServer,
    ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { type Request, type Response, Router } from "express";
import { z } from "zod";
import {
    AlreadyExistsError,
    ExpiryTooLargeError,
    ForbiddenError,
    NotFoundError,
} from "../lib/errors";
import { logger } from "../lib/logger";
import {
    createUrlSchema,
    listUrlsSchema,
    searchUrlsSchema,
} from "../lib/schemas";
import {
    createUrl,
    deleteAllUrls,
    deleteUrl,
    getStats,
    getUrl,
    listUrls,
    searchUrls,
} from "../services/url";

export const mcpRouter: Router = Router();

// Session store: sessionId -> { transport, userId }
const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; userId: string }
>();

function createMcpServer(userId: string): McpServer {
    const server = new McpServer({
        name: "url-shortener",
        version: "1.0.0",
    });

    // ── Resources ────────────────────────────────────────────────────────────

    server.registerResource(
        "all-urls",
        "urls://all",
        {
            description: "All your shortened URLs as JSON",
            mimeType: "application/json",
        },
        async (_uri) => {
            const urls = await listUrls(userId);
            return {
                contents: [
                    {
                        uri: "urls://all",
                        mimeType: "application/json",
                        text: JSON.stringify(urls, null, 2),
                    },
                ],
            };
        },
    );

    server.registerResource(
        "url-by-slug",
        new ResourceTemplate("urls://{slug}", { list: undefined }),
        {
            description: "A single shortened URL by slug",
            mimeType: "application/json",
        },
        async (uri, { slug }) => {
            try {
                const url = await getUrl(String(slug), userId);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            mimeType: "application/json",
                            text: JSON.stringify(url, null, 2),
                        },
                    ],
                };
            } catch (err) {
                if (
                    err instanceof NotFoundError ||
                    err instanceof ForbiddenError
                ) {
                    return {
                        contents: [
                            {
                                uri: uri.href,
                                mimeType: "text/plain",
                                text: (err as Error).message,
                            },
                        ],
                    };
                }
                throw err;
            }
        },
    );

    // ── Prompts ──────────────────────────────────────────────────────────────

    server.registerPrompt(
        "suggest_shorten",
        {
            description:
                "Suggest shortening a long URL using this MCP server. Use this whenever a long URL appears in context.",
            argsSchema: {
                longUrl: z.string().url().describe("The long URL to shorten"),
            },
        },
        ({ longUrl }) => ({
            description: "Suggest shortening a URL",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `I have this long URL: ${longUrl}`,
                    },
                },
                {
                    role: "assistant",
                    content: {
                        type: "text",
                        text: `That's a long URL! I can shorten it for you using the \`shorten_url\` tool. Would you like me to create a short link? I can also set a custom slug, expiry time, or TTL.`,
                    },
                },
            ],
        }),
    );

    // ── Tools ────────────────────────────────────────────────────────────────

    server.registerTool(
        "shorten_url",
        {
            description:
                "Create a new shortened URL and return only the short URL. Optionally provide a TTL or expiry date. If no slug is provided, an AI-suggested slug will be used. Use get_url or list_urls if you need the full URL record. Token savings are only realised when the slug is reused in future context; single-use URLs cost more context than pasting the original inline. Set tag to a brief note about the URL's purpose (e.g. 'auth API docs', 'PR #42') — this lets you retrieve it later via search_urls without needing to remember the slug or keep the context in the conversation.",
            inputSchema: createUrlSchema.shape,
        },
        async ({ longUrl, ttl, expiresAt, slug, tag }, extra) => {
            let resolvedSlug = slug;
            let resolvedTag = tag;

            // If slug or tag is missing and the client supports sampling, ask the LLM to suggest both
            const supportsSampling =
                !!server.server.getClientCapabilities()?.sampling;
            if ((!resolvedSlug || !resolvedTag) && supportsSampling) {
                try {
                    const result = await extra.sendRequest(
                        {
                            method: "sampling/createMessage",
                            params: {
                                messages: [
                                    {
                                        role: "user",
                                        content: {
                                            type: "text",
                                            text: `For this URL: ${longUrl}\n\nReply with ONLY a JSON object with two fields:\n- "slug": a short, memorable, URL-safe slug (lowercase, hyphens allowed, no spaces, max 30 chars)\n- "tag": a short phrase describing the URL's purpose (max 60 chars, e.g. "auth API docs", "PR #42")\n\nExample: {"slug":"my-slug","tag":"project readme"}`,
                                        },
                                    },
                                ],
                                maxTokens: 60,
                            },
                        },
                        CreateMessageResultSchema,
                    );
                    if (result.content.type === "text") {
                        try {
                            const parsed = JSON.parse(
                                result.content.text.trim(),
                            ) as {
                                slug?: unknown;
                                tag?: unknown;
                            };
                            if (
                                !resolvedSlug &&
                                typeof parsed.slug === "string"
                            ) {
                                const s = parsed.slug
                                    .trim()
                                    .toLowerCase()
                                    .replace(/[^a-z0-9-]/g, "-")
                                    .replace(/-+/g, "-")
                                    .replace(/^-|-$/g, "")
                                    .slice(0, 30);
                                if (s) resolvedSlug = s;
                            }
                            if (
                                !resolvedTag &&
                                typeof parsed.tag === "string"
                            ) {
                                const t = parsed.tag.trim().slice(0, 128);
                                if (t) resolvedTag = t;
                            }
                        } catch {
                            // JSON parse failed — fall back to treating the whole text as a slug
                            if (!resolvedSlug) {
                                const s = result.content.text
                                    .trim()
                                    .toLowerCase()
                                    .replace(/[^a-z0-9-]/g, "-")
                                    .replace(/-+/g, "-")
                                    .replace(/^-|-$/g, "")
                                    .slice(0, 30);
                                if (s) resolvedSlug = s;
                            }
                        }
                    }
                } catch {
                    // Sampling not supported or failed — fall back to random slug generation
                }
            }

            try {
                const url = await createUrl({
                    longUrl,
                    userId,
                    ttl,
                    slug: resolvedSlug,
                    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
                    tag,
                });
                return {
                    content: [{ type: "text", text: url.shortUrl }],
                };
            } catch (err) {
                if (
                    err instanceof ExpiryTooLargeError ||
                    err instanceof AlreadyExistsError
                ) {
                    return {
                        content: [
                            { type: "text", text: (err as Error).message },
                        ],
                        isError: true,
                    };
                }
                throw err;
            }
        },
    );

    server.registerTool(
        "bulk_shorten_urls",
        {
            description:
                "Shorten multiple URLs in a single call (max 20). Returns per-URL results including any errors. Each successful result includes estimatedTokensSaved — the per-substitution token saving if that slug is used in place of the full URL in future context. Savings are only realized when slugs are reused; this field does not account for the upfront cost of this tool call.",
            inputSchema: {
                urls: z
                    .array(z.object(createUrlSchema.shape))
                    .min(1)
                    .max(20)
                    .describe("List of URLs to shorten"),
            },
        },
        async ({ urls }) => {
            const results = await Promise.allSettled(
                urls.map((input) =>
                    createUrl({
                        ...input,
                        userId,
                        expiresAt: input.expiresAt
                            ? new Date(input.expiresAt)
                            : undefined,
                    }),
                ),
            );

            const output = results.map((result, i) => {
                const longUrl = urls[i]?.longUrl ?? "";
                if (result.status === "fulfilled") {
                    return { longUrl, success: true, data: result.value };
                }
                const err = result.reason;
                return {
                    longUrl,
                    success: false,
                    error: err instanceof Error ? err.message : "Unknown error",
                };
            });

            return {
                content: [
                    { type: "text", text: JSON.stringify(output, null, 2) },
                ],
            };
        },
    );

    server.registerTool(
        "get_url",
        {
            description:
                "Get details of a shortened URL by slug without incrementing clicks. Returns the URL record including estimatedTokensSaved — the per-substitution token saving if this slug is used in place of the full URL in future context. Only works for URLs you own.",
            inputSchema: {
                slug: z.string().describe("The short slug to look up"),
            },
        },
        async ({ slug }) => {
            try {
                const url = await getUrl(slug, userId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(url),
                        },
                    ],
                };
            } catch (err) {
                if (
                    err instanceof NotFoundError ||
                    err instanceof ForbiddenError
                ) {
                    return {
                        content: [
                            { type: "text", text: (err as Error).message },
                        ],
                        isError: true,
                    };
                }
                throw err;
            }
        },
    );

    server.registerTool(
        "list_urls",
        {
            description:
                "List all your shortened URLs. Each entry includes estimatedTokensSaved — the per-substitution token saving if that slug is used in place of the full URL in future context.",
            inputSchema: listUrlsSchema.shape,
        },
        async ({ order, orderBy }) => {
            const urls = await listUrls(userId, orderBy, order);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(urls),
                    },
                ],
            };
        },
    );

    server.registerTool(
        "search_urls",
        {
            description:
                "Search your shortened URLs by tag (substring) and/or long URL (substring). Returns tag and shortUrl only. At least one of tag or longUrl must be provided. Use this to look up a URL by the purpose note you set at creation time, or by a known fragment of the destination URL. Prefer this over list_urls when you know what you're looking for. Note: matching is case-sensitive.",
            inputSchema: searchUrlsSchema.shape,
        },
        async ({ tag, longUrl }) => {
            if (tag === undefined && longUrl === undefined) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "At least one of tag or longUrl must be provided",
                        },
                    ],
                    isError: true,
                };
            }
            const results = await searchUrls(userId, { tag, longUrl });
            const minimal = results.map(({ tag, shortUrl }) => ({
                tag,
                shortUrl,
            }));
            return {
                content: [{ type: "text", text: JSON.stringify(minimal) }],
            };
        },
    );

    server.registerTool(
        "get_stats",
        {
            description:
                "Return aggregate stats for your active URLs: total count and total estimatedTokensSaved across all of them. Use this to get a quick summary without loading the full URL list.",
            inputSchema: {},
        },
        async () => {
            const stats = await getStats(userId);
            return {
                content: [{ type: "text", text: JSON.stringify(stats) }],
            };
        },
    );

    server.registerTool(
        "delete_url",
        {
            description: "Delete one of your shortened URLs by slug.",
            inputSchema: {
                slug: z.string().describe("The short slug to delete"),
            },
        },
        async ({ slug }) => {
            try {
                await deleteUrl(slug, userId);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Deleted successfully.`,
                        },
                    ],
                };
            } catch (err) {
                if (
                    err instanceof NotFoundError ||
                    err instanceof ForbiddenError
                ) {
                    return {
                        content: [
                            { type: "text", text: (err as Error).message },
                        ],
                        isError: true,
                    };
                }
                throw err;
            }
        },
    );

    server.registerTool(
        "delete_all_urls",
        {
            description: "Delete all your shortened URLs.",
            inputSchema: {},
        },
        async () => {
            const count = await deleteAllUrls(userId);
            return {
                content: [
                    {
                        type: "text",
                        text: `Deleted ${count} URLs successfully.`,
                    },
                ],
            };
        },
    );

    return server;
}

// POST /mcp — handle MCP requests (new session or existing session)
mcpRouter.post("/", async (req: Request, res: Response) => {
    try {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        let transport: StreamableHTTPServerTransport;

        if (sessionId) {
            const session = sessions.get(sessionId);
            if (!session) {
                res.status(404).json({ error: "Session not found" });
                return;
            }
            transport = session.transport;
        } else {
            // New session — user is already resolved by authMiddleware
            const userId = req.user.id;

            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id) => {
                    sessions.set(id, { transport, userId });
                },
            });

            transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid) sessions.delete(sid);
            };

            const server = createMcpServer(userId);
            await server.connect(transport);
        }

        await transport.handleRequest(req, res, req.body);
    } catch (err) {
        logger.error("[MCP POST] error", err);
        res.status(500).json({ error: "Failed to handle MCP request" });
    }
});

// GET /mcp — SSE stream for server-sent events (existing session)
mcpRouter.get("/", async (req: Request, res: Response) => {
    try {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (!sessionId) {
            res.status(400).json({ error: "Missing mcp-session-id header" });
            return;
        }

        const session = sessions.get(sessionId);
        if (!session) {
            res.status(404).json({ error: "Session not found" });
            return;
        }

        await session.transport.handleRequest(req, res);
    } catch (err) {
        logger.error("[MCP GET] error", err);
        res.status(500).json({ error: "Failed to handle SSE request" });
    }
});

// DELETE /mcp — close a session
mcpRouter.delete("/", async (req: Request, res: Response) => {
    try {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (!sessionId) {
            res.status(400).json({ error: "Missing mcp-session-id header" });
            return;
        }

        const session = sessions.get(sessionId);
        if (!session) {
            res.status(404).json({ error: "Session not found" });
            return;
        }

        await session.transport.close();
        sessions.delete(sessionId);
        res.status(204).end();
    } catch (err) {
        logger.error("[MCP DELETE] error", err);
        res.status(500).json({ error: "Failed to close session" });
    }
});
