import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

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
    const computed = Buffer.from(hashKey(key, salt), "hex");
    const expected = Buffer.from(hash, "hex");
    if (computed.length !== expected.length) return false;
    return timingSafeEqual(computed, expected);
}
