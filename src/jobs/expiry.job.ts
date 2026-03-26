import { schedule } from "node-cron";
import { env } from "../lib/env";
import { deleteExpiredUrls } from "../services/url.service";

export function startExpiryJob(): void {
    schedule(env.EXPIRY_JOB_CRON, async () => {
        try {
            const count = await deleteExpiredUrls();
            if (count > 0) {
                console.log(`[expiry-job] Deleted ${count} expired URL(s)`);
            }
        } catch (err) {
            console.error("[expiry-job] Error deleting expired URLs:", err);
        }
    });

    console.log(`[expiry-job] Scheduled with cron: "${env.EXPIRY_JOB_CRON}"`);
}
