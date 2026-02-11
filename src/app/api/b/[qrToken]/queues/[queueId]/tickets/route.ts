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
  const supabase = await createClient({ "x-barbershop-qr-token": qrToken });

  const cookieStore = await cookies();
  const defaultName = cookieStore.get(CUSTOMER_NAME_COOKIE)?.value ?? "";

  const body = (await request.json().catch(() => null)) as null | {
    customerName?: unknown;
    serviceId?: unknown;
  };

  const customerName = normalizeName(
    typeof body?.customerName === "string" ? body.customerName : defaultName,
  );

  const serviceId = typeof body?.serviceId === "string" ? body.serviceId.trim() : "";

  const { data: token } = await supabase
    .from("barbershop_qr_tokens")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!token) {
    return NextResponse.json({ error: "invalid_qr" }, { status: 404 });
  }

  const { data: queue } = await supabase
    .from("merchant_queues")
    .select("id, merchant_id")
    .eq("id", queueId)
    .eq("merchant_id", token.merchant_id)
    .maybeSingle();

  if (!queue) {
    return NextResponse.json({ error: "invalid_queue" }, { status: 404 });
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
      merchant_id: token.merchant_id,
      queue_id: queueId,
      ticket_number: nextNumber,
      status: "waiting",
      customer_name: customerName || null,
      service_id: serviceId || null,
    })
    .select("id, ticket_number")
    .maybeSingle();

  if (error || !inserted) {
    return NextResponse.json({ error: "could_not_create" }, { status: 400 });
  }

  return NextResponse.json({ ticketId: inserted.id, ticketNumber: inserted.ticket_number });
}
