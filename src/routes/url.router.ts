import { type IRouter, type Request, type Response, Router } from "express";
import { createUrlSchema, slugParamSchema } from "../lib/schemas";
import { validateBody, validateParams } from "../middleware/validate";
import {
    createUrl,
    deleteUrl,
    getUrl,
    listUrls,
    resolveUrl,
} from "../services/url.service";

export const urlRouter: IRouter = Router();

// GET /urls — list URLs owned by the authenticated user
urlRouter.get("/", async (req: Request, res: Response) => {
    const urls = await listUrls(req.user.id);
    res.json(
        urls.map((url) => ({
            ...url,
            shortUrl: `${process.env.HOSTNAME}/${url.slug}`,
        })),
    );
});

// POST /urls — create a new shortened URL owned by the authenticated user
urlRouter.post("/", validateBody(createUrlSchema), async (req, res) => {
    const { longUrl, ttl, expiresAt } = req.body;

    const url = await createUrl({
        longUrl,
        userId: req.user.id,
        ttl,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json({
        ...url,
        shortUrl: `${process.env.HOSTNAME}/${url.slug}`,
    });
});

// GET /urls/:slug — get a single URL record (owner only)
urlRouter.get(
    "/:slug",
    validateParams(slugParamSchema),
    async (req: Request, res: Response) => {
        // After validation, we know slug exists
        const { slug } = req.params as { slug: string };
        const url = await getUrl(slug, req.user.id);
        res.json({
            ...url,
            shortUrl: `${process.env.HOSTNAME}/${url.slug}`,
        });
    },
);

// DELETE /urls/:slug — delete a shortened URL (owner only)
urlRouter.delete(
    "/:slug",
    validateParams(slugParamSchema),
    async (req: Request, res: Response) => {
        // After validation, we know slug exists
        const { slug } = req.params as { slug: string };
        await deleteUrl(slug, req.user.id);
        res.json({ message: "Deleted successfully" });
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

    res.redirect(301, url);
}
