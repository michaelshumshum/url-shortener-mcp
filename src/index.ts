#!/usr/bin/env node
import "express-async-errors";
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
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

// __dirname is 'dist/src' when compiled, 'src' when running via ts-node
const packageRoot =
    basename(resolve(__dirname, "..")) === "dist"
        ? resolve(__dirname, "../..")
        : resolve(__dirname, "..");
// Resolve absolute DB path (same logic as prisma.ts) and ensure directory exists
const dbRelPath = env.DATABASE_URL.replace(/^file:/, "");
const dbAbsPath = resolve(process.cwd(), dbRelPath);
mkdirSync(dirname(dbAbsPath), { recursive: true });

try {
    execFileSync(
        "npx",
        [
            "prisma",
            "migrate",
            "deploy",
            "--schema",
            resolve(packageRoot, "prisma/schema.prisma"),
        ],
        {
            cwd: packageRoot,
            stdio: "inherit",
            env: { ...process.env, DATABASE_URL: `file:${dbAbsPath}` },
        },
    );
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
        const inner = rawKey.length + 4;
        const pad = (s: string) => s + " ".repeat(inner - s.length);
        const center = (s: string) => {
            const left = Math.floor((inner - s.length) / 2);
            const right = inner - s.length - left;
            return " ".repeat(left) + s + " ".repeat(right);
        };
        const hr = "═".repeat(inner);
        process.stdout.write(
            [
                "",
                `╔${hr}╗`,
                `║${center("API KEY CREATED — SAVE THIS NOW")}║`,
                `╠${hr}╣`,
                `║  ${rawKey}  ║`,
                `║${" ".repeat(inner)}║`,
                `║${pad("  This key will not be shown again.")}║`,
                `╚${hr}╝`,
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
