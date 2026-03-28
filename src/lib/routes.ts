/**
 * Centralized route constants and small helpers for building paths.
 *
 * This file intentionally excludes any slug-related constants or helpers.
 * The bulk endpoint is represented directly as `/urls/bulk` (no joining).
 */

export const Routes = {
    // Top-level health check
    HEALTH: "/health",

    // API base for URL-related endpoints (mounted as app.use(Routes.URLS, ...))
    URLS: "/urls",

    // When used inside the router instance the "root" path is "/"
    // (i.e. urlRouter.get("/", ...) maps to GET /urls when router is mounted).
    URLS_ROOT: "/",

    // Bulk create endpoint as an explicit full path under the API base.
    // Use this constant directly — do not programmatically join it with `URLS`.
    URLS_BULK: "/urls/bulk",

    // MCP mount point
    MCP: "/mcp",

    /**
     * Append query parameters to a path.
     * Accepts a simple object of scalar values; values that are undefined are skipped.
     *
     * Example:
     *   withQuery(Routes.URLS, { orderBy: "createdAt", order: "asc" })
     *   -> "/urls?orderBy=createdAt&order=asc"
     */
    list(): string[] {
        const routes = Object.values(this)
            .filter((v) => typeof v === "string")
            .map((v) => v);
        return routes;
    },
    withQuery(
        base: string,
        params?: Record<string, string | number | boolean | undefined>,
    ): string {
        if (!params) return base;
        const entries = Object.entries(params).filter(
            ([, v]) => v !== undefined,
        );
        if (entries.length === 0) return base;
        const search = new URLSearchParams(
            entries.map(([k, v]) => [k, String(v)]),
        ).toString();
        return `${base}${base.includes("?") ? "&" : "?"}${search}`;
    },
} as const;

export type RoutesType = typeof Routes;
