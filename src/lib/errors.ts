export class ExpiryTooLargeError extends Error {
    constructor(maxSeconds: number) {
        const hours = (maxSeconds / 3600).toFixed(1);
        super(
            `Expiry exceeds the maximum allowed duration of ${maxSeconds}s (${hours}h)`,
        );
        this.name = "ExpiryTooLargeError";
    }
}

export class AlreadyExistsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AlreadyExistsError";
    }
}

export class NotFoundError extends Error {
    constructor() {
        super("URL not found");
        this.name = "NotFoundError";
    }
}

export class ForbiddenError extends Error {
    constructor() {
        super("You do not have permission to access this resource");
        this.name = "ForbiddenError";
    }
}

export class ValidationError extends Error {
    constructor(
        message: string,
        public details?: Record<string, string[]>,
    ) {
        super(message);
        this.name = "ValidationError";
    }
}
