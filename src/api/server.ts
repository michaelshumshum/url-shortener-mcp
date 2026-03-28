import { type IRouter, type Request, type Response, Router } from "express";
import { Routes, resolveRelativeRoute } from "../lib/routes";
import {
    bulkCreateUrlSchema,
    createUrlSchema,
    listUrlsSchema,
    slugParamSchema,
} from "../lib/schemas";
import {
    validateBody,
    validateParams,
    validateQuery,
} from "../middleware/validate";
import {
    createUrl,
    deleteAllUrls,
    deleteUrl,
    getUrl,
    listUrls,
    resolveUrl,
} from "../services/url";

export const urlRouter: IRouter = Router();

// GET /urls — list URLs owned by the authenticated user
urlRouter.get(
    "/",
    validateQuery(listUrlsSchema),
    async (req: Request, res: Response) => {
        const { orderBy, order } = req.query as {
            orderBy?: "createdAt" | "expiresAt" | "clicks";
            order?: "asc" | "desc";
        };
        const urls = await listUrls(req.user.id, orderBy, order);
        res.json(urls);
    },
);

// POST /urls — create a new shortened URL owned by the authenticated user
urlRouter.post("/", validateBody(createUrlSchema), async (req, res) => {
    const { longUrl, ttl, expiresAt, slug } = req.body;

    const url = await createUrl({
        longUrl,
        userId: req.user.id,
        ttl,
        slug,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json(url);
});

// POST /urls/bulk — shorten multiple URLs at once (owner only)
urlRouter.post(
    resolveRelativeRoute(Routes.URLS, Routes.URLS_BULK),
    validateBody(bulkCreateUrlSchema),
    async (req, res) => {
        const { urls } = req.body as {
            urls: {
                longUrl: string;
                ttl?: number;
                expiresAt?: string;
                slug?: string;
            }[];
        };

        const results = await Promise.allSettled(
            urls.map((input) =>
                createUrl({
                    ...input,
                    userId: req.user.id,
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

        res.status(207).json(output);
    },
);

// GET /urls/:slug — get a single URL record (owner only)
urlRouter.get(
    "/:slug",
    validateParams(slugParamSchema),
    async (req: Request, res: Response) => {
        const { slug } = req.params as { slug: string };
        const url = await getUrl(slug, req.user.id);
        res.json(url);
    },
);

// DELETE /urls — delete all shortened URLs (owner only)
urlRouter.delete("/", async (req: Request, res: Response) => {
    const count = await deleteAllUrls(req.user.id);
    res.json({ deleted: count });
});

// DELETE /urls/:slug — delete a shortened URL (owner only)
urlRouter.delete(
    "/:slug",
    validateParams(slugParamSchema),
    async (req: Request, res: Response) => {
        const { slug } = req.params as { slug: string };
        const url = await deleteUrl(slug, req.user.id);
        res.json(url);
    },
);

// GET /:slug — resolve and redirect (public, increments click count)
export async function handleRedirect(
    req: Request,
    res: Response,
): Promise<void> {
    const { slug } = req.params as { slug: string };
    const url = await resolveUrl(slug);

    if (!url) {
        res.status(404).json({ error: "URL not found" });
        return;
    }

    res.redirect(302, url);
}
