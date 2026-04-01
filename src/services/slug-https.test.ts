import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Tests the HTTPS=true branch of shortUrl (line 24 in slug.ts).
 * Uses vi.resetModules() + dynamic import so env is re-evaluated with
 * the updated process.env value.
 */
describe("shortUrl HTTPS branch", () => {
    afterEach(() => {
        vi.resetModules();
        process.env.HTTPS = "false";
    });

    it("uses https:// when HTTPS env is true", async () => {
        vi.resetModules();
        process.env.HTTPS = "true";
        const { shortUrl } = await import("./slug");

        expect(shortUrl({ slug: "abc" })).toMatch(/^https:\/\//);
    });
});
