/**
 *
 * Remove the base from the start of the path if it exists, returning the relative path.
 *
 * @param base
 * @param string
 * @returns
 */
export function resolveRelativeRoute(base: string, path: string): string {
    if (path.startsWith(base)) {
        return path.slice(base.length) || "/";
    }
    return path;
}

/**
 * Centralized route constants
 */
export const Routes = {
    HEALTH: "/health",
    URLS: "/urls",
    URLS_BULK: "/urls/bulk",

    MCP: "/mcp",

    /**
     *
     * Lists all route paths defined in this object.
     *
     * @returns An array of route paths
     */
    list(): string[] {
        const routes = Object.values(this)
            .filter((v) => typeof v === "string")
            .map((v) => v);
        return routes;
    },
    /**
     * Append query parameters to a path.
     * Accepts a simple object of scalar values; values that are undefined are skipped.
     *
     * Example:
     *   withQuery(Routes.URLS, { orderBy: "createdAt", order: "asc" })
     *   -> "/urls?orderBy=createdAt&order=asc"
     */
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
