import { createHmac, timingSafeEqual } from "node:crypto";

type OfflinePriceClaims = { merchantId: string; productId: string; priceCents: number; issuedAt: number };

function secret() {
  const value = process.env.OFFLINE_SALE_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("offline_sale_signing_secret_missing");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signOfflinePrice(merchantId: string, productId: string, price: number): string {
  const claims: OfflinePriceClaims = {
    merchantId,
    productId,
    priceCents: Math.round(price * 100),
    issuedAt: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyOfflinePrice(token: string, merchantId: string, productId: string, price: number): boolean {
  const [payload, receivedSignature, extra] = token.split(".");
  if (!payload || !receivedSignature || extra) return false;
  try {
    const expected = signature(payload);
    const left = Buffer.from(expected);
    const right = Buffer.from(receivedSignature);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OfflinePriceClaims;
    const age = Date.now() - Number(claims.issuedAt);
    return claims.merchantId === merchantId
      && claims.productId === productId
      && claims.priceCents === Math.round(price * 100)
      && age >= 0
      && age <= 30 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
