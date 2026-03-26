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
        HOSTNAME: z.string().default("localhost:3000"),
        HTTPS: z.coerce.boolean().default(false),
    },
    runtimeEnv: process.env,
});
