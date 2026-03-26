import "express-async-errors";
import "dotenv/config";
import { app } from "./app";
import { startExpiryJob } from "./jobs/expiry.job";
import { env } from "./lib/env";

// Process-level error handlers
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    // In production, might want to gracefully shutdown
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1); // Exit to let process manager restart
});

startExpiryJob();

app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
    console.log(`MCP endpoint: http://localhost:${env.PORT}/mcp`);
});
