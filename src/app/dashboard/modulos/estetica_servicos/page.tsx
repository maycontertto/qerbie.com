import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createAestheticService, updateAestheticService } from "@/lib/aesthetic/actions";

function formatBrlCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents ?? 0) / 100);
}

export default async function EsteticaServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canCatalog =
    isOwner ||
    (membership ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products") : false);

  if (!canCatalog) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Serviços</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Você não tem permissão para acessar este módulo.</p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("aesthetic_services")
    .select("id, name, description, important_notes, image_url, price_cents, duration_min, is_active, updated_at")
    .eq("merchant_id", merchant.id)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

  const banner =
    saved === "1"
      ? { kind: "success" as const, message: "Salvo." }
      : error === "invalid"
        ? { kind: "error" as const, message: "Dados inválidos." }
        : error === "save_failed"
          ? { kind: "error" as const, message: "Não foi possível salvar agora. Tente novamente." }
          : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Serviços</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Procedimentos estéticos, valores e duração.</p>
        </div>

        {banner ? (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              banner.kind === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {banner.message}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Novo procedimento</h2>
            <form action={createAestheticService} className="mt-4 space-y-3">
              <input type="hidden" name="return_to" value="/dashboard/modulos/estetica_servicos" />
              <input
                name="name"
                required
                minLength={2}
                placeholder="Ex: Limpeza de pele"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <textarea
                name="description"
                placeholder="Descrição (opcional)"
                className="min-h-20 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <textarea
                name="important_notes"
                placeholder="Observações importantes (opcional)"
                className="min-h-16 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="image_url"
                placeholder="Foto (URL) (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="price_cents"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Preço (centavos)"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <input
                  name="duration_min"
                  type="number"
                  min={5}
                  max={24 * 60}
                  step={5}
                  defaultValue={30}
                  placeholder="Duração (min)"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Criar
              </button>
            </form>
          </aside>

          <section className="space-y-3">
            {items?.length ? (
              items.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{s.name}</h3>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatBrlCents(Number(s.price_cents ?? 0))} • {Number(s.duration_min ?? 30)}min
                      </p>
                      {s.description ? (
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{s.description}</p>
                      ) : null}
                      {s.important_notes ? (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{s.important_notes}</p>
                      ) : null}
                      {s.image_url ? (
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Foto: {s.image_url}</p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        s.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {s.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <form action={updateAestheticService} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="return_to" value="/dashboard/modulos/estetica_servicos" />
                    <input type="hidden" name="id" value={s.id} />
                    <input
                      name="name"
                      defaultValue={s.name}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <input
                      name="price_cents"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={String(Number(s.price_cents ?? 0))}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <textarea
                      name="description"
                      defaultValue={s.description ?? ""}
                      className="min-h-16 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 sm:col-span-2"
                    />
                    <textarea
                      name="important_notes"
                      defaultValue={s.important_notes ?? ""}
                      className="min-h-16 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 sm:col-span-2"
                    />
                    <input
                      name="image_url"
                      defaultValue={s.image_url ?? ""}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 sm:col-span-2"
                    />
                    <input
                      name="duration_min"
                      type="number"
                      min={5}
                      max={24 * 60}
                      step={5}
                      defaultValue={String(Number(s.duration_min ?? 30))}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">Ativo</span>
                      <input
                        type="checkbox"
                        name="is_active"
                        defaultChecked={Boolean(s.is_active)}
                        className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                      />
                    </label>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="submit"
                        className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                Nenhum procedimento cadastrado ainda.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
