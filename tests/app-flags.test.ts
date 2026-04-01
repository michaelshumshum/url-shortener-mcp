import supertest from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Tests the ENABLE_API=false and ENABLE_MCP=false branches in app.ts.
 * Uses vi.resetModules() + dynamic import so app.ts is re-evaluated with
 * the updated process.env values.
 */
describe("app feature flags", () => {
    afterEach(() => {
        vi.resetModules();
    });

    it("does not register /urls routes when ENABLE_API is false", async () => {
        vi.resetModules();
        process.env.ENABLE_API = "false";
        const { app } = await import("../src/app");
        process.env.ENABLE_API = "true";

        // POST /urls has no matching route → 404 (not 401 from auth middleware)
        const res = await supertest(app).post("/urls").send({});
        expect(res.status).toBe(404);
    });

    it("does not register /mcp routes when ENABLE_MCP is false", async () => {
        vi.resetModules();
        process.env.ENABLE_MCP = "false";
        const { app } = await import("../src/app");
        process.env.ENABLE_MCP = "true";

        // POST /mcp has no matching route → 404
        const res = await supertest(app).post("/mcp").send({});
        expect(res.status).toBe(404);
    });
});
