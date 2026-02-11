import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createPetProfile, updatePetProfile } from "@/lib/pet/actions";

export default async function PetHistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;

  const canManage =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products") ||
        hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canManage) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Histórico do pet</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: pets } = await supabase
    .from("pet_profiles")
    .select("id, pet_name, owner_name, owner_contact, notes, updated_at")
    .eq("merchant_id", merchant.id)
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
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Histórico do pet</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Preferências e ocorrências operacionais (sem prontuário médico).
          </p>
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
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Novo pet</h2>
            <form action={createPetProfile} className="mt-4 space-y-3">
              <input type="hidden" name="return_to" value="/dashboard/modulos/pet_historico" />
              <input
                name="pet_name"
                required
                minLength={2}
                placeholder="Nome do pet"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="owner_name"
                placeholder="Tutor (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="owner_contact"
                placeholder="Contato (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <textarea
                name="notes"
                placeholder="Observações (opcional)"
                className="min-h-24 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
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
            {pets?.length ? (
              (pets ?? []).map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{p.pet_name}</h3>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {p.owner_name ? `Tutor: ${p.owner_name}` : "Sem tutor"}
                      {p.owner_contact ? ` • ${p.owner_contact}` : ""}
                    </p>
                  </div>

                  <form action={updatePetProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="return_to" value="/dashboard/modulos/pet_historico" />
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      name="pet_name"
                      defaultValue={p.pet_name}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <input
                      name="owner_name"
                      defaultValue={p.owner_name ?? ""}
                      placeholder="Tutor (opcional)"
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <input
                      name="owner_contact"
                      defaultValue={p.owner_contact ?? ""}
                      placeholder="Contato (opcional)"
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 sm:col-span-2"
                    />
                    <textarea
                      name="notes"
                      defaultValue={p.notes ?? ""}
                      className="min-h-24 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 sm:col-span-2"
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
              <div className="rounded-2xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                Nenhum pet cadastrado ainda.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
