import Link from "next/link";
import { headers } from "next/headers";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createGymQrToken, deactivateGymQrToken } from "@/lib/gym/actions";
import { TableQrPanel } from "@/app/dashboard/modulos/mesas/TableQrPanel";

export default async function AcademiaQrPage({
  searchParams,
}: {
  searchParams: Promise<{ qr?: string; error?: string }>;
}) {
  const { qr, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;

  const canQr =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products") ||
        hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canQr) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">QR de cadastro</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Você não tem permissão para acessar este módulo.</p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: tokens } = await supabase
    .from("gym_qr_tokens")
    .select("id, label, qr_token, is_active, created_at")
    .eq("merchant_id", merchant.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const activeQrToken = qr ?? tokens?.[0]?.qr_token ?? null;

  const banner =
    error === "invalid" ? "Dados inválidos." : error === "save_failed" ? "Não foi possível gerar o QR agora." : null;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const activeCustomerUrl = activeQrToken ? `${origin}/g/${encodeURIComponent(activeQrToken)}` : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">QR de cadastro</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Cliente escaneia, cria login e vê instruções de pagamento.
            </p>
          </div>

          {activeCustomerUrl ? (
            <a
              href={activeCustomerUrl}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Abrir como aluno
            </a>
          ) : null}
        </div>

        {banner ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {banner}
          </div>
        ) : null}

        <section className="mt-6 space-y-6">
          {activeCustomerUrl ? <TableQrPanel url={activeCustomerUrl} /> : null}

          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Gerar QR</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Crie um QR para cadastro de aluno.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Novo QR</h3>
                <form action={createGymQrToken} className="mt-3 space-y-3">
                  <input type="hidden" name="return_to" value="/dashboard/modulos/academia_qr" />
                  <input
                    name="label"
                    type="text"
                    defaultValue="Academia"
                    className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Gerar QR
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">QRs</h3>
                {!tokens?.length ? (
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Nenhum QR criado ainda.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {(tokens ?? []).map((t) => (
                      <li
                        key={t.id}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm dark:bg-zinc-900 ${
                          t.qr_token === activeQrToken
                            ? "border-zinc-900 bg-white ring-1 ring-zinc-900/10 dark:border-zinc-50 dark:ring-zinc-50/10"
                            : "border-zinc-200 bg-white dark:border-zinc-800"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{t.label}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.is_active ? "Ativo" : "Inativo"}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          {t.is_active ? (
                            <form action={deactivateGymQrToken}>
                              <input type="hidden" name="return_to" value="/dashboard/modulos/academia_qr" />
                              <input type="hidden" name="id" value={t.id} />
                              <button
                                type="submit"
                                className="text-xs font-semibold text-zinc-600 hover:underline dark:text-zinc-300"
                              >
                                Desativar
                              </button>
                            </form>
                          ) : null}

                          <a
                            href={`/dashboard/modulos/academia_qr?qr=${encodeURIComponent(t.qr_token)}`}
                            aria-current={t.qr_token === activeQrToken ? "page" : undefined}
                            className={`text-xs font-semibold hover:underline ${
                              t.qr_token === activeQrToken
                                ? "text-zinc-400 dark:text-zinc-500"
                                : "text-zinc-600 dark:text-zinc-300"
                            }`}
                          >
                            Ver QR
                          </a>

                          <a
                            href={`${origin}/g/${encodeURIComponent(t.qr_token)}`}
                            className="text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                          >
                            Abrir
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
