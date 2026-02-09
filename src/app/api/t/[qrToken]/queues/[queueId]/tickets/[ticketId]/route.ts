import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TicketStatus = "waiting" | "called" | "serving" | "completed" | "cancelled" | "no_show";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ qrToken: string; queueId: string; ticketId: string }> },
) {
  const { qrToken, queueId, ticketId } = await params;
  const supabase = await createClient();

  const { data: table } = await supabase
    .from("merchant_tables")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "invalid_qr" }, { status: 404 });
  }

  const { data: queue } = await supabase
    .from("merchant_queues")
    .select("id, merchant_id, avg_service_min")
    .eq("id", queueId)
    .eq("merchant_id", table.merchant_id)
    .maybeSingle();

  if (!queue) {
    return NextResponse.json({ error: "invalid_queue" }, { status: 404 });
  }

  const { data: ticket } = await supabase
    .from("queue_tickets")
    .select("id, ticket_number, status")
    .eq("id", ticketId)
    .eq("queue_id", queueId)
    .maybeSingle();

  if (!ticket) {
    return NextResponse.json({ error: "invalid_ticket" }, { status: 404 });
  }

  const status = ticket.status as TicketStatus;

  const { count: aheadCount } = await supabase
    .from("queue_tickets")
    .select("id", { count: "exact", head: true })
    .eq("queue_id", queueId)
    .eq("status", "waiting")
    .lt("ticket_number", ticket.ticket_number);

  const position = status === "waiting" ? Number(aheadCount ?? 0) + 1 : 0;

  const avg = Number(queue.avg_service_min ?? 0);
  const etaMinutes = status === "waiting" && avg > 0 ? Math.max(0, (position - 1) * avg) : null;

  return NextResponse.json({
    ticketNumber: ticket.ticket_number,
    status,
    position,
    etaMinutes,
  });
}
