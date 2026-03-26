#!/usr/bin/env node
import "express-async-errors";
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
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

// Auto-run migrations on startup
const packageRoot = join(__dirname, "../..");
const prismaBin = join(packageRoot, "node_modules", ".bin", "prisma");
try {
    execFileSync(prismaBin, ["migrate", "deploy"], {
        cwd: packageRoot,
        stdio: "inherit",
        env: process.env,
    });
} catch {
    logger.warn(
        "[startup] could not apply migrations automatically — ensure DATABASE_URL is set and run `prisma migrate deploy` manually",
    );
}

startExpiryJob();

app.listen(env.PORT, () => {
    logger.info(`[server] listening on port ${env.PORT}`);
});
