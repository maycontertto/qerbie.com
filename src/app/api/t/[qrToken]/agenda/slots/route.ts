import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ qrToken: string }> },
) {
  const { qrToken } = await params;
  const supabase = await createClient();

  const { data: table } = await supabase
    .from("merchant_tables")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "invalid_qr" }, { status: 404 });
  }

  const { data: slots, error } = await supabase
    .from("merchant_appointment_slots")
    .select("id, queue_id, starts_at, ends_at")
    .eq("merchant_id", table.merchant_id)
    .eq("is_active", true)
    .eq("status", "available")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json({ slots: slots ?? [] });
}
