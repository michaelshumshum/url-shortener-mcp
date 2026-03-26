import "express-async-errors";
import "dotenv/config";
import { app } from "./app";
import { startExpiryJob } from "./jobs/expiry.job";
import { env } from "./lib/env";
import { logger } from "./lib/logger";

// Process-level error handlers
process.on("unhandledRejection", (reason, promise) => {
    logger.error(`unhandled rejection at: ${String(promise)}`, reason);
});

process.on("uncaughtException", (error) => {
    logger.error("uncaught exception", error);
    process.exit(1);
});

startExpiryJob();

app.listen(env.PORT, () => {
    logger.info(`[server] listening on port ${env.PORT}`);
});
