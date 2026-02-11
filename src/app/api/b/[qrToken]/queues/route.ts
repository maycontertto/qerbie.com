import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ qrToken: string }> },
) {
  const { qrToken } = await params;
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

  const { data: queues } = await supabase
    .from("merchant_queues")
    .select("id, name, avg_service_min")
    .eq("merchant_id", token.merchant_id)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  return NextResponse.json({ queues: queues ?? [] });
}
