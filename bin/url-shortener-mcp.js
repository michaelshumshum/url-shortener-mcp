#!/usr/bin/env node

// Parse CLI args into process.env BEFORE any module is loaded.
// This must run before require('../dist/src/index') so that env.ts
// reads the correct values when it initialises.
const argv = process.argv.slice(2);
const flagMap = {
    "--port": "PORT",
    "-p": "PORT",
    "--database-url": "DATABASE_URL",
    "--hostname": "HOSTNAME",
    "--https": "HTTPS",
    "--enable-api": "ENABLE_API",
    "--enable-mcp": "ENABLE_MCP",
    "--max-expiry-seconds": "MAX_EXPIRY_SECONDS",
    "--inactive-user-cutoff": "INACTIVE_USER_CUTOFF_SECONDS",
};

for (let i = 0; i < argv.length; i++) {
    const envKey = flagMap[argv[i]];
    if (envKey !== undefined && argv[i + 1] !== undefined) {
        process.env[envKey] = argv[++i];
    }
}

if (argv.includes("--create-user")) {
    require("../dist/scripts/create-user");
} else {
    require("../dist/src/index");
}
