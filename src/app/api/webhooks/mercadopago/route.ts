import { NextResponse } from "next/server";
import { syncMercadoPagoApprovedPayment } from "@/lib/billing/sync";

export async function POST(request: Request) {
  // Mercado Pago can send GET/POST with query params; we parse both body and URL.
  const url = new URL(request.url);

  let paymentId: string | null = null;

  // Common query: ?type=payment&data.id=123
  paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");

  // Try body JSON
  if (!paymentId) {
    try {
      const bodyUnknown: unknown = await request.json().catch(() => null);
      const body = bodyUnknown as null | { data?: { id?: unknown }; id?: unknown };
      paymentId = body?.data?.id ? String(body.data.id) : body?.id ? String(body.id) : null;
    } catch {
      // ignore
    }
  }

  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await syncMercadoPagoApprovedPayment(paymentId);
  if (!result.ok) {
    return NextResponse.json({ ok: true, ignored: true, reason: result.reason });
  }

  return NextResponse.json({ ok: true, applied: result.applied ?? false });
}

export async function GET(request: Request) {
  // Some Mercado Pago configurations send GET notifications.
  return POST(request);
}
