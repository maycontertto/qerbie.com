import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { CUSTOMER_NAME_COOKIE } from "@/lib/customer/constants";

function normalizeName(input: string): string {
  const v = input.trim();
  if (v.length < 2) return "";
  return v.slice(0, 60);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ qrToken: string; queueId: string }> },
) {
  const { qrToken, queueId } = await params;
  const supabase = await createClient();

  const cookieStore = await cookies();
  const defaultName = cookieStore.get(CUSTOMER_NAME_COOKIE)?.value ?? "";

  const body = (await request.json().catch(() => null)) as null | { customerName?: unknown };
  const customerName = normalizeName(
    typeof body?.customerName === "string" ? body.customerName : defaultName,
  );

  const { data: table } = await supabase
    .from("merchant_tables")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "invalid_qr" }, { status: 404 });
  }

  // Ensure queue belongs to merchant.
  const { data: queue } = await supabase
    .from("merchant_queues")
    .select("id, merchant_id")
    .eq("id", queueId)
    .eq("merchant_id", table.merchant_id)
    .maybeSingle();

  if (!queue) {
    return NextResponse.json({ error: "invalid_queue" }, { status: 404 });
  }

  // Determine next ticket number (per queue per day).
  const { data: last } = await supabase
    .from("queue_tickets")
    .select("ticket_number")
    .eq("queue_id", queueId)
    .order("ticket_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNumber = Number(last?.ticket_number ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("queue_tickets")
    .insert({
      merchant_id: table.merchant_id,
      queue_id: queueId,
      ticket_number: nextNumber,
      status: "waiting",
      customer_name: customerName || null,
    })
    .select("id, ticket_number")
    .maybeSingle();

  if (error || !inserted) {
    // If unique collision happened, client can retry.
    return NextResponse.json({ error: "could_not_create" }, { status: 400 });
  }

  return NextResponse.json({ ticketId: inserted.id, ticketNumber: inserted.ticket_number });
}
