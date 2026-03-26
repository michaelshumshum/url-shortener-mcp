import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { type Request, type Response, Router } from "express";
import { z } from "zod";
import {
    ExpiryTooLargeError,
    ForbiddenError,
    NotFoundError,
} from "../lib/errors";
import { logger } from "../lib/logger";
import { createUrlSchema, listUrlsSchema } from "../lib/schemas";
import {
    createUrl,
    deleteAllUrls,
    deleteUrl,
    getUrl,
    listUrls,
} from "../services/url.service";

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

    // Use shared schema for shorten_url tool
    server.registerTool(
        "shorten_url",
        {
            description:
                "Create a new shortened URL. Optionally provide a TTL or expiry date.",
            inputSchema: createUrlSchema.shape,
        },
        async ({ longUrl, ttl, expiresAt, slug }) => {
            try {
                const url = await createUrl({
                    longUrl,
                    userId,
                    ttl,
                    slug,
                    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(url),
                        },
                    ],
                };
            } catch (err) {
                if (err instanceof ExpiryTooLargeError) {
                    return {
                        content: [{ type: "text", text: err.message }],
                        isError: true,
                    };
                }
                throw err;
            }
        },
    );

    server.registerTool(
        "get_url",
        {
            description:
                "Get details of a shortened URL by slug without incrementing clicks and see how many times it has been clicked. Only works for URLs you own.",
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
                        content: [{ type: "text", text: err.message }],
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
            description: "List all your shortened URLs.",
            inputSchema: listUrlsSchema,
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
        "delete_url",
        {
            description: "Delete one of your shortened URLs by slug.",
            inputSchema: {
                slug: z.string().describe("The short slug to delete"),
            },
        },
        async ({ slug }) => {
            try {
                const url = await deleteUrl(slug, userId);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Deleted successfully.\n${JSON.stringify(url, null, 2)}`,
                        },
                    ],
                };
            } catch (err) {
                if (
                    err instanceof NotFoundError ||
                    err instanceof ForbiddenError
                ) {
                    return {
                        content: [{ type: "text", text: err.message }],
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
