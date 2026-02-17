import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { gymSignIn, gymSignUp } from "@/lib/gym/customerActions";
import { buildMerchantBranding, getButtonStyle } from "@/lib/merchant/branding";

function maskPix(pix: string): string {
  const v = pix.trim();
  if (v.length <= 10) return v;
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

function formatBrlCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents ?? 0) / 100,
  );
}

export default async function GymCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ qrToken: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { qrToken } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();

  // Resolve QR → merchant
  const { data: qr } = await supabase
    .from("gym_qr_tokens")
    .select("merchant_id, label")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .single();

  if (!qr?.merchant_id) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">QR inválido</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Peça um novo QR para a academia.</p>
          </div>
        </div>
      </div>
    );
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select(
      "name, brand_display_name, brand_logo_url, brand_primary_color, payment_pix_key, payment_pix_description, payment_card_url, payment_card_description, payment_cash_description, payment_disclaimer",
    )
    .eq("id", qr.merchant_id)
    .single();

  const { data: plans } = await supabase
    .from("gym_plans")
    .select("id, name, price_cents, billing_period_months")
    .eq("merchant_id", qr.merchant_id)
    .eq("is_active", true)
    .order("price_cents", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(50);

  const branding = merchant
    ? buildMerchantBranding({
        name: merchant.name,
        brand_display_name: merchant.brand_display_name,
        brand_logo_url: merchant.brand_logo_url,
        brand_primary_color: merchant.brand_primary_color,
      })
    : { displayName: "Academia", logoUrl: null, primaryColor: null };

  const button = getButtonStyle(branding.primaryColor);

  // If logged in (cookie forwarded as x-gym-session-token), allow anon select on gym_students.
  const { data: me } = await supabase
    .from("gym_students")
    .select("id, name")
    .eq("merchant_id", qr.merchant_id)
    .limit(1)
    .maybeSingle();

  const { data: membership } = me
    ? await supabase
        .from("gym_memberships")
        .select("id, status, next_due_at, last_paid_at")
        .eq("merchant_id", qr.merchant_id)
        .eq("student_id", me.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const banner =
    error === "auth_failed"
      ? "Login ou senha inválidos."
      : error === "login_taken"
        ? "Esse usuário já existe. Tente outro."
      : error === "signup_failed"
        ? "Não foi possível criar seu cadastro."
        : error === "invalid"
          ? "Dados inválidos."
          : error === "invalid_qr"
            ? "QR inválido."
            : null;

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
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {branding.displayName}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{qr.label ?? "Academia"}</p>
        </div>

        {banner ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {banner}
          </div>
        ) : null}

        {me && membership ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Olá, {me.name}.</p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Status: <span className="font-semibold">{membership.status}</span>
              {membership.next_due_at ? ` • Vencimento: ${membership.next_due_at}` : ""}
            </p>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Pagamento</p>
              {merchant?.payment_pix_key || merchant?.payment_card_url || merchant?.payment_cash_description ? (
                <div className="mt-2 space-y-3">
                  {merchant?.payment_pix_key ? (
                    <div className="space-y-2">
                      <p className="text-sm text-zinc-700 dark:text-zinc-200">
                        PIX: <span className="font-semibold">{maskPix(merchant.payment_pix_key)}</span>
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 break-words">{merchant.payment_pix_key}</p>
                      {merchant.payment_pix_description ? (
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">{merchant.payment_pix_description}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {merchant?.payment_card_url ? (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Link (cartão/checkout)</p>
                      {merchant.payment_card_description ? (
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">{merchant.payment_card_description}</p>
                      ) : null}
                      <a
                        href={merchant.payment_card_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50 break-words"
                      >
                        {merchant.payment_card_url}
                      </a>
                    </div>
                  ) : null}

                  {merchant?.payment_cash_description ? (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Dinheiro</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">{merchant.payment_cash_description}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  A academia ainda não configurou as formas de pagamento.
                </p>
              )}
              {merchant?.payment_disclaimer ? (
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{merchant.payment_disclaimer}</p>
              ) : null}
            </div>

            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              Se você acabou de pagar, aguarde a confirmação do atendente.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Entrar</h2>
              <form action={gymSignIn} className="mt-3 space-y-3">
                <input type="hidden" name="qr_token" value={qrToken} />
                <input
                  name="login"
                  required
                  minLength={2}
                  placeholder="Usuário"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <input
                  name="password"
                  type="password"
                  required
                  minLength={4}
                  placeholder="Senha"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <button type="submit" className={button.className} style={button.style}>
                  Entrar
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Primeiro acesso</h2>
              <form action={gymSignUp} className="mt-3 space-y-3">
                <input type="hidden" name="qr_token" value={qrToken} />
                <select
                  name="plan_id"
                  defaultValue=""
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <option value="">Escolha um plano (opcional)</option>
                  {(plans ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatBrlCents(Number(p.price_cents ?? 0))} / {Number(p.billing_period_months ?? 1)}m)
                    </option>
                  ))}
                </select>
                <input
                  name="login"
                  required
                  minLength={2}
                  placeholder="Crie um usuário"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <input
                  name="password"
                  type="password"
                  required
                  minLength={4}
                  placeholder="Crie uma senha"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <button type="submit" className={button.className} style={button.style}>
                  Criar cadastro
                </button>
              </form>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Ao criar cadastro, você verá status e instruções de pagamento.
              </p>
            </div>

            <Link href="/" className="text-center text-xs text-zinc-500 hover:underline dark:text-zinc-400">
              Voltar
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
