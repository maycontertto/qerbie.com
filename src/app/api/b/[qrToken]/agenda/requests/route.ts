import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customer/constants";

type RequestBody = {
  slotId?: unknown;
  customerName?: unknown;
  contact?: unknown;
  notes?: unknown;
  serviceId?: unknown;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ qrToken: string }> },
) {
  const { qrToken } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value ?? "";

  if (!sessionToken) {
    return NextResponse.json({ error: "missing_session" }, { status: 401 });
  }

  const supabase = await createClient({ "x-barbershop-qr-token": qrToken });

  const { data: token } = await supabase
    .from("barbershop_qr_tokens")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!token) {
    return NextResponse.json({ error: "invalid_qr" }, { status: 404 });
  }

  const bodyUnknown: unknown = await req.json().catch(() => null);
  const body = asObject(bodyUnknown) as RequestBody | null;

  const slotId = typeof body?.slotId === "string" ? body.slotId.trim() : "";
  const customerName = typeof body?.customerName === "string" ? body.customerName.trim().slice(0, 80) : "";
  const contact = typeof body?.contact === "string" ? body.contact.trim().slice(0, 120) : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 400) : "";
  const serviceId = typeof body?.serviceId === "string" ? body.serviceId.trim() : "";

  if (!slotId) {
    return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
  }

  if (serviceId) {
    const { data: service } = await supabase
      .from("barbershop_services")
      .select("id")
      .eq("id", serviceId)
      .eq("merchant_id", token.merchant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!service) {
      return NextResponse.json({ error: "invalid_service" }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("merchant_appointment_requests")
    .insert({
      merchant_id: token.merchant_id,
      slot_id: slotId,
      session_token: sessionToken,
      customer_name: customerName || null,
      customer_contact: contact || null,
      customer_notes: notes || null,
      status: "pending",
      service_id: serviceId || null,
      slot_starts_at: new Date().toISOString(),
      slot_ends_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "request_failed" }, { status: 400 });
  }

  return NextResponse.json({ requestId: data.id });
}
