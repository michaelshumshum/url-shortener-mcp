import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
    server: {
        NODE_ENV: z
            .enum(["development", "production", "test"])
            .default("development"),
        PORT: z.coerce.number().int().positive().default(3000),
        DATABASE_URL: z.string().min(1).default("file:./prisma/dev.db"),
        EXPIRY_JOB_CRON: z.string().min(1).default("* * * * *"),
        MAX_EXPIRY_SECONDS: z.coerce.number().int().positive().default(86400),
        INACTIVE_USER_CUTOFF_SECONDS: z.coerce
            .number()
            .int()
            .positive()
            .default(604800), // 1 week
        INACTIVE_USER_JOB_CRON: z.string().min(1).default("0 * * * *"), // hourly
        HOSTNAME: z.string().default("localhost:3000"),
        HTTPS: z
            .enum(["true", "false"])
            .transform((v) => v === "true")
            .default(false),
        ENABLE_API: z
            .enum(["true", "false", ""])
            .transform((v) => v === "true")
            .default(true),
        ENABLE_MCP: z
            .enum(["true", "false"])
            .transform((v) => v === "true")
            .default(true),
    },
    runtimeEnv: process.env,
});

console.log(env.HTTPS, !!process.env.HTTPS);
