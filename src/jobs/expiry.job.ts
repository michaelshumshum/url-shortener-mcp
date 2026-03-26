import { schedule } from "node-cron";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { deleteExpiredUrls } from "../services/url.service";

export function startExpiryJob(): void {
    schedule(env.EXPIRY_JOB_CRON, async () => {
        try {
            const count = await deleteExpiredUrls();
            if (count > 0) {
                logger.info(`[expiry-job] deleted ${count} expired URL(s)`);
            }
        } catch (err) {
            logger.error("[expiry-job] error deleting expired URLs", err);
        }
    });

    logger.info(`[expiry-job] scheduled with cron: "${env.EXPIRY_JOB_CRON}"`);
}
