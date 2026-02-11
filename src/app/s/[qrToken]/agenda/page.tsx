import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customer/constants";
import { CustomerInvalidQr } from "@/app/t/CustomerInvalidQr";
import { CustomerBeautyAgendaBrowser } from "@/app/s/[qrToken]/agenda/CustomerBeautyAgendaBrowser";

export default async function SalaoAgendaPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value);

  const supabase = await createClient({ "x-beauty-qr-token": qrToken });

  const { data: token } = await supabase
    .from("beauty_qr_tokens")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!token) {
    return <CustomerInvalidQr backHref={`/s/${encodeURIComponent(qrToken)}`} />;
  }

  const [{ data: queues }, { data: slots }, { data: services }, { data: mapRows }] = await Promise.all([
    supabase
      .from("merchant_queues")
      .select("id, name")
      .eq("merchant_id", token.merchant_id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("merchant_appointment_slots")
      .select("id, queue_id, starts_at, ends_at")
      .eq("merchant_id", token.merchant_id)
      .eq("is_active", true)
      .eq("status", "available")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("beauty_services")
      .select("id, name, price_cents, duration_min, notes")
      .eq("merchant_id", token.merchant_id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    supabase
      .from("beauty_queue_services")
      .select("queue_id, service_id")
      .eq("merchant_id", token.merchant_id),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-md space-y-6">
        <Link
          href={`/s/${encodeURIComponent(qrToken)}/menu`}
          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        >
          ← Voltar
        </Link>

        {!services?.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            Nenhum serviço ativo cadastrado. Peça para o salão cadastrar os serviços.
          </div>
        ) : (
          <CustomerBeautyAgendaBrowser
            qrToken={qrToken}
            slots={slots ?? []}
            queues={queues ?? []}
            services={services ?? []}
            queueServices={mapRows ?? []}
            hasSession={hasSession}
          />
        )}
      </div>
    </div>
  );
}
