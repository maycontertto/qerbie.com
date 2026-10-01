import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customer/constants";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ qrToken: string; requestId: string }> },
) {
  const { qrToken, requestId } = await params;
  const sessionToken = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value ?? "";
  if (!sessionToken) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: qr } = await createAdminClient()
    .from("merchant_tables")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();
  if (!qr) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = await createClient({ "x-session-token": sessionToken });

  const { data, error } = await supabase
    .from("merchant_appointment_requests")
    .select(
      "id, status, slot_starts_at, slot_ends_at, queue_id, customer_name, customer_contact, customer_notes",
    )
    .eq("id", requestId)
    .eq("merchant_id", qr.merchant_id)
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    status: data.status,
    slotStartsAt: data.slot_starts_at,
    slotEndsAt: data.slot_ends_at,
    queueId: data.queue_id,
    customerName: data.customer_name,
    customerContact: data.customer_contact,
    customerNotes: data.customer_notes,
  });
}
