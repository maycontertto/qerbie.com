import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createHotelGuest, updateHotelGuest } from "@/lib/merchant/hotelActions";

export default async function HospedesModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canOps =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canOps) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Hóspedes</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: guests } = await supabase
    .from("merchant_hotel_guests")
    .select("id, full_name, phone, email, notes, is_active, updated_at")
    .eq("merchant_id", merchant.id)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);

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
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Hóspedes</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Cadastre hóspedes e preferências.
          </p>
        </div>

        {banner && (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              banner.kind === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {banner.message}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Novo hóspede</h2>
            <form action={createHotelGuest} className="mt-4 space-y-3">
              <input
                name="full_name"
                required
                minLength={2}
                placeholder="Nome completo"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="phone"
                placeholder="Telefone (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="email"
                placeholder="Email (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <textarea
                name="notes"
                rows={3}
                placeholder="Preferências / observações (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Criar
              </button>
            </form>
          </aside>

          <section className="space-y-3">
            {guests?.length ? (
              guests.map((g) => (
                <div
                  key={g.id}
                  className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{g.full_name}</h3>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {g.phone ? `Tel: ${g.phone}` : ""}
                        {g.phone && g.email ? " • " : ""}
                        {g.email ? g.email : ""}
                      </p>
                      {g.notes ? (
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{g.notes}</p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        g.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {g.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <form action={updateHotelGuest} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={g.id} />
                    <input
                      name="full_name"
                      defaultValue={g.full_name}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <input
                      name="phone"
                      defaultValue={g.phone ?? ""}
                      placeholder="Telefone"
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <input
                      name="email"
                      defaultValue={g.email ?? ""}
                      placeholder="Email"
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">Ativo</span>
                      <input
                        type="checkbox"
                        name="is_active"
                        defaultChecked={Boolean(g.is_active)}
                        className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                      />
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={g.notes ?? ""}
                      placeholder="Preferências / observações"
                      className="sm:col-span-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
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
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                Nenhum hóspede cadastrado ainda.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
