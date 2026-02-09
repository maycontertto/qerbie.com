import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customer/constants";

type RequestBody = {
  slotId?: unknown;
  customerName?: unknown;
  contact?: unknown;
  notes?: unknown;
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

  const supabase = await createClient();

  const { data: table } = await supabase
    .from("merchant_tables")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "invalid_qr" }, { status: 404 });
  }

  const bodyUnknown: unknown = await req.json().catch(() => null);
  const body = asObject(bodyUnknown) as RequestBody | null;

  const slotId = typeof body?.slotId === "string" ? body.slotId.trim() : "";
  const customerName = typeof body?.customerName === "string" ? body.customerName.trim().slice(0, 80) : "";
  const contact = typeof body?.contact === "string" ? body.contact.trim().slice(0, 120) : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 400) : "";

  if (!slotId) {
    return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
  }

  // Insert relies on DB trigger to:
  // - validate slot availability
  // - set merchant_id/queue_id and snapshot times
  // - flip slot status to pending
  const { data, error } = await supabase
    .from("merchant_appointment_requests")
    .insert({
      // merchant_id/queue_id/slot times are overwritten by trigger
      merchant_id: table.merchant_id,
      slot_id: slotId,
      session_token: sessionToken,
      customer_name: customerName || null,
      customer_contact: contact || null,
      customer_notes: notes || null,
      status: "pending",
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
