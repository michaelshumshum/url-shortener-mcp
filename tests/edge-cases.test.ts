/**
 * Targeted tests for code paths that are hard to reach through the main
 * HTTP/MCP test suites (require mocking internal modules or calling
 * middleware directly).
 */
import type { NextFunction, Request, Response } from "express";
import supertest from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { logger } from "../src/lib/logger";
import * as prismaModule from "../src/lib/prisma";
import { authMiddleware } from "../src/middleware/auth";
import {
    apiLoggingMiddleware,
    mcpLoggingMiddleware,
} from "../src/middleware/logging";

const request = supertest(app);

// ---------------------------------------------------------------------------
// GET /health — database error path (app.ts lines 49-50)
// ---------------------------------------------------------------------------

describe("GET /health database error", () => {
    beforeEach(() => {
        vi.spyOn(prismaModule.prisma, "$queryRaw").mockRejectedValueOnce(
            new Error("connection refused"),
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns 503 when the database query fails", async () => {
        const res = await request.get("/health");
        expect(res.status).toBe(503);
        expect(res.body.status).toBe("error");
        expect(res.body.database).toBe("disconnected");
    });
});

// ---------------------------------------------------------------------------
// authMiddleware — internal error path (auth.ts lines 75-76)
// ---------------------------------------------------------------------------

describe("authMiddleware internal error", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns 500 when prisma.user.findMany throws", async () => {
        vi.spyOn(prismaModule.prisma.user, "findMany").mockRejectedValueOnce(
            new Error("DB exploded"),
        );

        const req = {
            headers: { authorization: "Bearer some-key" },
        } as unknown as Request;
        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        } as unknown as Response;

        await authMiddleware(req, res, vi.fn() as unknown as NextFunction);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ---------------------------------------------------------------------------
// Logging middleware — anonymous user path (logging.ts lines 7, 23)
// ---------------------------------------------------------------------------

describe("logging middleware without req.user", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("apiLoggingMiddleware uses 'anonymous' when req.user is absent", () => {
        const spy = vi.spyOn(logger, "info").mockImplementation(() => {});

        const finishCallbacks: (() => void)[] = [];
        const req = {
            method: "GET",
            originalUrl: "/test",
            // no req.user
        } as Request;
        const res = {
            on: (_event: string, cb: () => void) => {
                finishCallbacks.push(cb);
            },
            statusCode: 200,
        } as unknown as Response;

        apiLoggingMiddleware(req, res, vi.fn() as unknown as NextFunction);
        finishCallbacks[0]?.();

        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0]?.[0]).toContain("anonymous");
    });

    it("mcpLoggingMiddleware uses 'anonymous' when req.user is absent", () => {
        const spy = vi.spyOn(logger, "info").mockImplementation(() => {});

        const finishCallbacks: (() => void)[] = [];
        const req = {
            method: "POST",
            body: { method: "tools/list" },
            // no req.user
        } as Request;
        const res = {
            on: (_event: string, cb: () => void) => {
                finishCallbacks.push(cb);
            },
            statusCode: 200,
        } as unknown as Response;

        mcpLoggingMiddleware(req, res, vi.fn() as unknown as NextFunction);
        finishCallbacks[0]?.();

        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0]?.[0]).toContain("anonymous");
    });
});
