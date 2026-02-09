import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildMerchantBranding } from "@/lib/merchant/branding";
import { cookies } from "next/headers";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customer/constants";
import { CustomerInvalidQr } from "@/app/t/CustomerInvalidQr";
import { CustomerQueueBrowser } from "./CustomerQueueBrowser";

export default async function CustomerQueuePage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value);
  const supabase = await createClient();

  const { data: table } = await supabase
    .from("merchant_tables")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!table) {
    return <CustomerInvalidQr backHref={`/t/${encodeURIComponent(qrToken)}`} />;
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("name, brand_display_name, brand_logo_url, brand_primary_color")
    .eq("id", table.merchant_id)
    .maybeSingle();

  const branding = merchant
    ? buildMerchantBranding(merchant)
    : { displayName: "Qerbie", logoUrl: null, primaryColor: null };

  const { data: queues } = await supabase
    .from("merchant_queues")
    .select("id, name, avg_service_min")
    .eq("merchant_id", table.merchant_id)
    .eq("is_active", true)
    .eq("status", "open")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={branding.displayName}
                  className="h-10 w-10 rounded-xl border border-zinc-200 bg-white object-contain p-1.5 dark:border-zinc-800"
                />
              ) : null}
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {branding.displayName}
              </h1>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Fila de atendimento</p>
          </div>

          <Link
            href={`/t/${encodeURIComponent(qrToken)}/menu`}
            className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            Ver serviços
          </Link>
        </div>

        {!hasSession && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-semibold">Digite seu nome para entrar na fila</p>
            <p className="mt-1 text-xs opacity-90">
              O atendimento fica vinculado ao seu dispositivo.
            </p>
            <Link
              href={`/t/${encodeURIComponent(qrToken)}`}
              className="mt-3 inline-block rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500"
            >
              Digitar meu nome
            </Link>
          </div>
        )}

        {(queues ?? []).length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            A clínica ainda não abriu filas.
          </div>
        ) : (
          <CustomerQueueBrowser
            qrToken={qrToken}
            queues={queues ?? []}
            hasSession={hasSession}
          />
        )}

        <Link
          href={`/t/${encodeURIComponent(qrToken)}/menu`}
          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        >
          Voltar
        </Link>
      </div>
    </div>
  );
}
