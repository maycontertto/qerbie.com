import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const PBKDF2_ITERATIONS = 100_000;
const KEYLEN = 32;
const DIGEST = "sha256";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEYLEN, DIGEST);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const [kind, iterStr, saltB64, hashB64] = parts;
  if (kind !== "pbkdf2") return false;
  const iterations = Number(iterStr);
  if (!Number.isFinite(iterations) || iterations < 10_000) return false;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
