import { PrismaLibSql } from "@prisma/adapter-libsql";
import "dotenv/config";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";
import { PrismaClient } from "../generated/prisma/client";

// Set test database URL before anything else
const testDbPath = path.resolve(process.cwd(), "tests/test.db");
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.NODE_ENV = "test";
process.env.HTTPS = "false";
process.env.HOSTNAME = "url-shortener-mcp-test.com";
process.env.ENABLE_API = "true";
process.env.ENABLE_MCP = "true";

let prisma: PrismaClient;

beforeAll(async () => {
    // Run migrations on test database
    try {
        execSync("pnpm prisma migrate deploy", {
            env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
            stdio: "inherit",
        });
    } catch (err) {
        console.error("Failed to run migrations:", err);
    }

    // Create Prisma client with test database
    const adapter = new PrismaLibSql({ url: `file:${testDbPath}` });
    prisma = new PrismaClient({ adapter });
});

afterAll(async () => {
    await prisma.$disconnect();
    if (existsSync(testDbPath)) rmSync(testDbPath);
});

export { prisma };
