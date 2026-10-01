import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createHotelRoomType, updateHotelRoomType } from "@/lib/merchant/hotelActions";

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function QuartosModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canCatalog =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products")
      : false);

  if (!canCatalog) {
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
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Quartos</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient({}, { withAuth: true });
  const { data: roomTypes } = await supabase
    .from("merchant_hotel_room_types")
    .select("id, name, description, capacity, base_price, is_active, updated_at")
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Quartos</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Cadastre tipos de quartos com capacidade e preço base.
            </p>
          </div>
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
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Novo tipo</h2>
            <form action={createHotelRoomType} className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Nome do tipo
              <input
                name="name"
                required
                minLength={2}
                placeholder="Ex: Standard Casal"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              </label>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Capacidade de hóspedes
              <input
                name="capacity"
                inputMode="numeric"
                placeholder="Capacidade (ex: 2)"
                defaultValue="2"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              </label>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Preço base por noite (R$)
              <input
                name="base_price"
                inputMode="decimal"
                placeholder="Preço base (ex: 199,90)"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              </label>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Descrição
              <input
                name="description"
                placeholder="Descrição opcional"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              </label>
              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Criar
              </button>
            </form>
          </aside>

          <section className="space-y-3">
            {roomTypes?.length ? (
              roomTypes.map((rt) => (
                <div
                  key={rt.id}
                  className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{rt.name}</h3>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Capacidade: {rt.capacity} • Base: {formatBrl(Number(rt.base_price ?? 0))}
                      </p>
                      {rt.description ? (
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{rt.description}</p>
                      ) : null}
                    </div>

                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        rt.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {rt.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <form action={updateHotelRoomType} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={rt.id} />
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Nome do tipo
                      <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={120}
                        defaultValue={rt.name}
                        className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </label>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Capacidade de hóspedes
                      <input
                        name="capacity"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={20}
                        defaultValue={String(rt.capacity ?? 1)}
                        className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </label>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Preço base por noite (R$)
                      <input
                        name="base_price"
                        inputMode="decimal"
                        defaultValue={Number(rt.base_price ?? 0).toFixed(2).replace(".", ",")}
                        className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">Ativo</span>
                      <input
                        type="checkbox"
                        name="is_active"
                        defaultChecked={Boolean(rt.is_active)}
                        className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                      />
                    </label>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 sm:col-span-2">Descrição (opcional)
                      <textarea
                        name="description"
                        rows={2}
                        maxLength={500}
                        defaultValue={rt.description ?? ""}
                        placeholder="Detalhes do quarto, comodidades incluídas etc."
                        className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
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
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                Nenhum tipo de quarto cadastrado ainda.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
