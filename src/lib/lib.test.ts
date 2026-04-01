import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSalt, hashKey, verifyKey } from "./crypto";
import {
    AlreadyExistsError,
    ExpiryTooLargeError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
} from "./errors";
import { logger } from "./logger";
import { Routes, resolveRelativeRoute } from "./routes";

// ── resolveRelativeRoute ─────────────────────────────────────────────────────

describe("resolveRelativeRoute", () => {
    it("strips the base prefix and returns the relative path", () => {
        expect(resolveRelativeRoute("/urls", "/urls/bulk")).toBe("/bulk");
    });

    it("returns / when path equals the base exactly", () => {
        expect(resolveRelativeRoute("/urls", "/urls")).toBe("/");
    });

    it("returns path unchanged when it does not start with base", () => {
        expect(resolveRelativeRoute("/urls", "/other")).toBe("/other");
    });
});

// ── Routes.list ──────────────────────────────────────────────────────────────

describe("Routes.list", () => {
    it("returns all string route constants", () => {
        const list = Routes.list();
        expect(list).toContain("/health");
        expect(list).toContain("/urls");
        expect(list).toContain("/mcp");
        expect(list.every((r) => typeof r === "string")).toBe(true);
    });
});

// ── Routes.withQuery ─────────────────────────────────────────────────────────

describe("Routes.withQuery", () => {
    it("returns base unchanged when params is omitted", () => {
        expect(Routes.withQuery("/urls")).toBe("/urls");
    });

    it("returns base unchanged when all param values are undefined", () => {
        expect(Routes.withQuery("/urls", { order: undefined })).toBe("/urls");
    });

    it("appends defined params as a query string", () => {
        const result = Routes.withQuery("/urls", {
            orderBy: "createdAt",
            order: "asc",
        });
        expect(result).toContain("orderBy=createdAt");
        expect(result).toContain("order=asc");
        expect(result.startsWith("/urls?")).toBe(true);
    });

    it("skips undefined values but keeps defined ones", () => {
        const result = Routes.withQuery("/urls", {
            order: "desc",
            orderBy: undefined,
        });
        expect(result).toBe("/urls?order=desc");
    });

    it("uses & when base already contains a query string", () => {
        const result = Routes.withQuery("/urls?foo=bar", { order: "asc" });
        expect(result).toBe("/urls?foo=bar&order=asc");
    });
});

// ── logger ───────────────────────────────────────────────────────────────────

describe("logger", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("logger.info writes to stdout with INFO level", () => {
        const spy = vi
            .spyOn(process.stdout, "write")
            .mockImplementation(() => true);
        logger.info("hello info");
        expect(spy).toHaveBeenCalledOnce();
        const output = String(spy.mock.calls[0]?.[0]);
        expect(output).toContain("INFO");
        expect(output).toContain("hello info");
    });

    it("logger.warn writes to stdout with WARN level", () => {
        const spy = vi
            .spyOn(process.stdout, "write")
            .mockImplementation(() => true);
        logger.warn("hello warn");
        expect(spy).toHaveBeenCalledOnce();
        const output = String(spy.mock.calls[0]?.[0]);
        expect(output).toContain("WARN");
        expect(output).toContain("hello warn");
    });

    it("logger.error writes to stderr with ERROR level", () => {
        const spy = vi
            .spyOn(process.stderr, "write")
            .mockImplementation(() => true);
        logger.error("oops");
        expect(spy).toHaveBeenCalledOnce();
        const output = String(spy.mock.calls[0]?.[0]);
        expect(output).toContain("ERROR");
        expect(output).toContain("oops");
    });

    it("logger.error appends Error stack when present", () => {
        const spy = vi
            .spyOn(process.stderr, "write")
            .mockImplementation(() => true);
        const err = new Error("boom");
        logger.error("caught:", err);
        const output = String(spy.mock.calls[0]?.[0]);
        expect(output).toContain("boom");
    });

    it("logger.error falls back to Error message when stack is missing", () => {
        const spy = vi
            .spyOn(process.stderr, "write")
            .mockImplementation(() => true);
        const err = new Error("no-stack");
        delete err.stack;
        logger.error("caught:", err);
        const output = String(spy.mock.calls[0]?.[0]);
        expect(output).toContain("no-stack");
    });

    it("logger.error stringifies non-Error extras", () => {
        const spy = vi
            .spyOn(process.stderr, "write")
            .mockImplementation(() => true);
        logger.error("label", 42);
        const output = String(spy.mock.calls[0]?.[0]);
        expect(output).toContain("42");
    });
});

// ── error classes ────────────────────────────────────────────────────────────

describe("error classes", () => {
    it("ExpiryTooLargeError has statusCode 400 and formats the duration", () => {
        const err = new ExpiryTooLargeError(7200);
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain("7200s");
        expect(err.message).toContain("2.0h");
        expect(err.name).toBe("ExpiryTooLargeError");
    });

    it("AlreadyExistsError has statusCode 400", () => {
        const err = new AlreadyExistsError("slug taken");
        expect(err.statusCode).toBe(400);
        expect(err.message).toBe("slug taken");
        expect(err.name).toBe("AlreadyExistsError");
    });

    it("NotFoundError has statusCode 404", () => {
        const err = new NotFoundError();
        expect(err.statusCode).toBe(404);
        expect(err.name).toBe("NotFoundError");
    });

    it("ForbiddenError has statusCode 403", () => {
        const err = new ForbiddenError();
        expect(err.statusCode).toBe(403);
        expect(err.name).toBe("ForbiddenError");
    });

    it("ValidationError has statusCode 400 with optional details", () => {
        const err = new ValidationError("bad input", { field: ["required"] });
        expect(err.statusCode).toBe(400);
        expect(err.details).toEqual({ field: ["required"] });
        expect(err.name).toBe("ValidationError");
    });

    it("ValidationError without details leaves details undefined", () => {
        const err = new ValidationError("bad input");
        expect(err.details).toBeUndefined();
    });
});

// ── crypto ───────────────────────────────────────────────────────────────────

describe("verifyKey", () => {
    it("returns true for a matching key", () => {
        const salt = generateSalt();
        const hash = hashKey("my-key", salt);
        expect(verifyKey("my-key", salt, hash)).toBe(true);
    });

    it("returns false for a wrong key", () => {
        const salt = generateSalt();
        const hash = hashKey("correct", salt);
        expect(verifyKey("wrong", salt, hash)).toBe(false);
    });

    it("returns false when the stored hash has a different byte length", () => {
        const salt = generateSalt();
        // "short" decodes to fewer bytes than a sha256 hex digest
        expect(verifyKey("any-key", salt, "short")).toBe(false);
    });
});
