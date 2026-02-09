import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ qrToken: string; requestId: string }> },
) {
  const { requestId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("merchant_appointment_requests")
    .select(
      "id, status, slot_starts_at, slot_ends_at, queue_id, customer_name, customer_contact, customer_notes",
    )
    .eq("id", requestId)
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
