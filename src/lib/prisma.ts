import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../../generated/prisma/client";
import { env } from "./env";

const dbPath = env.DATABASE_URL.replace(/^file:/, "");
const resolvedPath = path.resolve(process.cwd(), dbPath);

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
    const adapter = new PrismaLibSql({ url: `file:${resolvedPath}` });
    return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
