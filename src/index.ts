#!/usr/bin/env node
import "express-async-errors";
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { app } from "./app";
import { startExpiryJob } from "./jobs/expiry.job";
import { generateSalt, hashKey } from "./lib/crypto";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";

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
    logger.error(
        "[startup] migrations failed — ensure DATABASE_URL is set and the database is accessible",
    );
    process.exit(1);
}

async function main() {
    // Auto-create a user if none exist
    const userCount = await prisma.user.count();
    if (userCount === 0) {
        const rawKey = randomBytes(32).toString("hex");
        const salt = generateSalt();
        await prisma.user.create({
            data: { key: hashKey(rawKey, salt), salt },
        });
        process.stdout.write(
            [
                "",
                "╔══════════════════════════════════════════════════════════╗",
                "║              API KEY CREATED — SAVE THIS NOW             ║",
                "╠══════════════════════════════════════════════════════════╣",
                `║  ${rawKey}  ║`,
                "║                                                          ║",
                "║  This key will not be shown again.                       ║",
                "╚══════════════════════════════════════════════════════════╝",
                "",
            ].join("\n"),
        );
    }

    startExpiryJob();

    app.listen(env.PORT, () => {
        logger.info(`[server] listening on port ${env.PORT}`);
    });
}

main().catch((err) => {
    logger.error("[startup] fatal error", err);
    process.exit(1);
});
