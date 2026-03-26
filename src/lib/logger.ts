type Level = "INFO" | "WARN" | "ERROR";

function log(level: Level, message: string): void {
    const line = `${new Date().toISOString()} ${level.padEnd(5)} ${message}\n`;
    if (level === "ERROR") {
        process.stderr.write(line);
    } else {
        process.stdout.write(line);
    }
}

export const logger = {
    info: (message: string) => log("INFO", message),
    warn: (message: string) => log("WARN", message),
    error: (message: string, err?: unknown) => {
        const detail =
            err instanceof Error
                ? (err.stack ?? err.message)
                : err !== undefined
                  ? String(err)
                  : undefined;
        log("ERROR", detail ? `${message} ${detail}` : message);
    },
};
