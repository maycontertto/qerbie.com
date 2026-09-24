import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const encoded = process.env.FISCAL_DATA_ENCRYPTION_KEY;
  if (!encoded) throw new Error("FISCAL_DATA_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("FISCAL_DATA_ENCRYPTION_KEY must be a 32-byte base64 key");
  return key;
}

export function encryptFiscalValue(value: Uint8Array | string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value)),
    cipher.final(),
  ]);
  return `v1:${iv.toString("base64").replace(/=+$/, "")}:${cipher.getAuthTag().toString("base64").replace(/=+$/, "")}:${encrypted.toString("base64")}`;
}

export function decryptFiscalValue(value: string): Buffer {
  const [version, ivText, tagText, encryptedText] = value.split(":");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) throw new Error("Invalid encrypted fiscal value");
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]);
}

export function maskTaxId(digits: string): string {
  if (digits.length === 11) return `***.***.**${digits.slice(8, 9)}-${digits.slice(9)}`;
  if (digits.length === 14) return `**.***.***/****-${digits.slice(12)}`;
  return "Documento cadastrado";
}
