import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../lib/errors";

/**
 * Middleware to validate request body against a Zod schema
 * @param schema - The Zod schema to validate against
 * @returns Express middleware function
 */
export function validateBody(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const details = result.error.flatten().fieldErrors;
            next(new ValidationError("Validation failed", details));
            return;
        }
        req.body = result.data;
        next();
    };
}

/**
 * Middleware to validate request params against a Zod schema
 * @param schema - The Zod schema to validate against
 * @returns Express middleware function
 */
export function validateParams(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            const details = result.error.flatten().fieldErrors;
            next(new ValidationError("Invalid parameters", details));
            return;
        }
        // Type assertion is safe here because we've validated with the schema
        req.params = result.data as typeof req.params;
        next();
    };
}
