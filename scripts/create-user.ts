import "dotenv/config";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";
import { createUser } from "../src/services/user";

const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const dbPath = dbUrl.replace(/^file:/, "");
const resolvedPath = path.resolve(process.cwd(), dbPath);

const adapter = new PrismaLibSql({ url: resolvedPath });
const prisma = new PrismaClient({ adapter });

async function main() {
    const { user, key } = await createUser();

    console.log("User created successfully.");
    console.log("");
    console.log(`  ID:  ${user.id}`);
    console.log(`  Key: ${key}`);
    console.log("");
    console.log("Store this key securely — it will not be shown again.");
}

main()
    .catch((err) => {
        console.error("Failed to create user:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
