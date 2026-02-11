import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customer/constants";

type RequestBody = {
  slotId?: unknown;
  customerName?: unknown;
  vehicleLabel?: unknown;
  contact?: unknown;
  notes?: unknown;
  serviceId?: unknown;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeVehicleLabel(input: string): string {
  const v = input.trim();
  if (v.length < 2) return "";
  return v.slice(0, 120);
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

  const supabase = await createClient({ "x-carwash-qr-token": qrToken });

  const { data: token } = await supabase
    .from("carwash_qr_tokens")
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
  const vehicleLabel = normalizeVehicleLabel(typeof body?.vehicleLabel === "string" ? body.vehicleLabel : "");
  const contact = typeof body?.contact === "string" ? body.contact.trim().slice(0, 120) : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 400) : "";
  const serviceId = typeof body?.serviceId === "string" ? body.serviceId.trim() : "";

  if (!slotId) {
    return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
  }

  const { data: slot } = await supabase
    .from("merchant_appointment_slots")
    .select("id, queue_id, merchant_id, starts_at, ends_at, status, is_active")
    .eq("id", slotId)
    .eq("merchant_id", token.merchant_id)
    .maybeSingle();

  if (!slot || !slot.is_active || slot.status !== "available") {
    return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
  }

  if (serviceId) {
    const { data: service } = await supabase
      .from("carwash_services")
      .select("id")
      .eq("id", serviceId)
      .eq("merchant_id", token.merchant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!service) {
      return NextResponse.json({ error: "invalid_service" }, { status: 400 });
    }

    const { data: anyForService } = await supabase
      .from("carwash_queue_services")
      .select("id")
      .eq("merchant_id", token.merchant_id)
      .eq("service_id", serviceId)
      .limit(1);

    if ((anyForService ?? []).length && slot.queue_id) {
      const { data: allowed } = await supabase
        .from("carwash_queue_services")
        .select("id")
        .eq("merchant_id", token.merchant_id)
        .eq("service_id", serviceId)
        .eq("queue_id", slot.queue_id)
        .maybeSingle();

      if (!allowed) {
        return NextResponse.json({ error: "invalid_professional" }, { status: 400 });
      }
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
      vehicle_label: vehicleLabel || null,
      carwash_service_id: serviceId || null,
      slot_starts_at: slot.starts_at,
      slot_ends_at: slot.ends_at,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "request_failed" }, { status: 400 });
  }

  return NextResponse.json({ requestId: data.id });
}
