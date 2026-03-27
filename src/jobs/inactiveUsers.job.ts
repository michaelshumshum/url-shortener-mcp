import { schedule } from "node-cron";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { deleteInactiveUsers } from "../services/url.service";

export function startInactiveUsersJob(): void {
    schedule(env.INACTIVE_USER_JOB_CRON, async () => {
        try {
            const count = await deleteInactiveUsers();
            if (count > 0) {
                logger.info(
                    `[inactive-users-job] deleted ${count} inactive user(s)`,
                );
            }
        } catch (err) {
            logger.error(
                "[inactive-users-job] error deleting inactive users",
                err,
            );
        }
    });

    logger.info(
        `[inactive-users-job] scheduled with cron: "${env.INACTIVE_USER_JOB_CRON}"`,
    );
}
