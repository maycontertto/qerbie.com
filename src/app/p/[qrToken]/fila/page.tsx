import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customer/constants";
import { CustomerInvalidQr } from "@/app/t/CustomerInvalidQr";
import { CustomerPetQueueBrowser } from "@/app/p/[qrToken]/fila/CustomerPetQueueBrowser";

export default async function PetShopFilaPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value);

  const supabase = await createClient({ "x-pet-qr-token": qrToken });

  const { data: token } = await supabase
    .from("pet_qr_tokens")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!token) {
    return <CustomerInvalidQr backHref={`/p/${encodeURIComponent(qrToken)}`} />;
  }

  const [{ data: queues }, { data: services }, { data: mapRows }] = await Promise.all([
    supabase
      .from("merchant_queues")
      .select("id, name, avg_service_min")
      .eq("merchant_id", token.merchant_id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("pet_services")
      .select("id, name, price_cents, duration_min, notes")
      .eq("merchant_id", token.merchant_id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    supabase.from("pet_queue_services").select("queue_id, service_id").eq("merchant_id", token.merchant_id),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-md space-y-6">
        <Link
          href={`/p/${encodeURIComponent(qrToken)}/menu`}
          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        >
          ← Voltar
        </Link>

        {!services?.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            Nenhum serviço ativo cadastrado. Peça para o pet shop cadastrar os serviços.
          </div>
        ) : !queues?.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            Nenhum profissional/fila ativo cadastrado. Peça para o pet shop cadastrar a equipe.
          </div>
        ) : (
          <CustomerPetQueueBrowser
            qrToken={qrToken}
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
