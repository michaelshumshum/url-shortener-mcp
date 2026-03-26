import { createHash, randomBytes } from "node:crypto";

const HASH_ALGORITHM = "sha256";

export function generateSalt(): string {
    return randomBytes(16).toString("hex");
}

export function hashKey(key: string, salt: string): string {
    return createHash(HASH_ALGORITHM)
        .update(salt + key)
        .digest("hex");
}

export function verifyKey(key: string, salt: string, hash: string): boolean {
    return hashKey(key, salt) === hash;
}
