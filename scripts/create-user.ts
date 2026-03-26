import "dotenv/config";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { generateSalt, hashKey } from "../src/lib/crypto";

const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const dbPath = dbUrl.replace(/^file:/, "");
const resolvedPath = path.resolve(process.cwd(), dbPath);

const adapter = new PrismaBetterSqlite3({ url: resolvedPath });
const prisma = new PrismaClient({ adapter });

async function main() {
    const rawKey = randomBytes(32).toString("hex");
    const salt = generateSalt();
    const hashedKey = hashKey(rawKey, salt);

    const user = await prisma.user.create({
        data: {
            key: hashedKey,
            salt,
        },
    });

    console.log("User created successfully.");
    console.log("");
    console.log(`  ID:  ${user.id}`);
    console.log(`  Key: ${rawKey}`);
    console.log("");
    console.log("Store this key securely — it will not be shown again.");
}

main()
    .catch((err) => {
        console.error("Failed to create user:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
