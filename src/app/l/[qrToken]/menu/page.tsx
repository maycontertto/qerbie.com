import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CustomerInvalidQr } from "@/app/t/CustomerInvalidQr";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customer/constants";
import { buildMerchantBranding } from "@/lib/merchant/branding";

export default async function LavaJatoMenuPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value);

  const supabase = await createClient({ "x-carwash-qr-token": qrToken });

  const { data: token } = await supabase
    .from("carwash_qr_tokens")
    .select("label, merchant_id")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!token) {
    return <CustomerInvalidQr backHref={`/l/${encodeURIComponent(qrToken)}`} />;
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("name, brand_display_name, brand_logo_url, brand_primary_color")
    .eq("id", token.merchant_id)
    .maybeSingle();

  const branding = merchant
    ? buildMerchantBranding(merchant)
    : { displayName: "Qerbie", logoUrl: null, primaryColor: null };

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          {branding.logoUrl ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={branding.logoUrl}
                alt={branding.displayName}
                className="h-16 w-16 rounded-2xl border border-zinc-200 bg-white object-contain p-2 dark:border-zinc-800"
              />
            </div>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{branding.displayName}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{token.label}</p>
        </div>

        {!hasSession ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
            Para continuar, informe seu nome.
            <div className="mt-2">
              <Link href={`/l/${encodeURIComponent(qrToken)}`} className="font-semibold hover:underline">
                Começar
              </Link>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3">
          <a
            href={`/l/${encodeURIComponent(qrToken)}/fila`}
            className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recepção (chegada)</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Confirme sua presença e entre na fila do atendimento.
            </div>
          </a>

          <a
            href={`/l/${encodeURIComponent(qrToken)}/agenda`}
            className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agendar horário</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Escolha serviço e horário disponível.
            </div>
          </a>
        </div>

        <div className="text-center">
          <a
            href={`/l/${encodeURIComponent(qrToken)}`}
            className="text-xs font-semibold text-zinc-600 hover:underline dark:text-zinc-300"
          >
            Trocar nome
          </a>
        </div>
      </div>
    </div>
  );
}
