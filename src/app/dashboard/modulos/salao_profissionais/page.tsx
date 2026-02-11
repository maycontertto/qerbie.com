import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { updateBeautyProfessionalServices } from "@/lib/beauty/actions";

export default async function SalaoProfissionaisPage({
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
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Profissionais</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: queues }, { data: services }, { data: mappings }] = await Promise.all([
    supabase
      .from("merchant_queues")
      .select("id, name, status, is_active")
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("beauty_services")
      .select("id, name, is_active")
      .eq("merchant_id", merchant.id)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false }),
    supabase
      .from("beauty_queue_services")
      .select("queue_id, service_id")
      .eq("merchant_id", merchant.id),
  ]);

  const selectedByQueue = new Map<string, Set<string>>();
  for (const r of mappings ?? []) {
    const set = selectedByQueue.get(r.queue_id) ?? new Set<string>();
    set.add(r.service_id);
    selectedByQueue.set(r.queue_id, set);
  }

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
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Profissionais</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Vincule quais serviços cada profissional realiza.
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

        <section className="mt-8 space-y-4">
          {!queues?.length ? (
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              Nenhum profissional/fila ativo cadastrado ainda. Crie filas no módulo Recepção.
            </div>
          ) : !services?.length ? (
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              Nenhum serviço cadastrado ainda. Cadastre serviços primeiro.
            </div>
          ) : (
            (queues ?? []).map((q) => {
              const selected = selectedByQueue.get(q.id) ?? new Set<string>();
              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{q.name}</h2>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Selecione os serviços que este profissional atende.
                      </p>
                    </div>
                  </div>

                  <form action={updateBeautyProfessionalServices} className="mt-4 space-y-4">
                    <input type="hidden" name="return_to" value="/dashboard/modulos/salao_profissionais" />
                    <input type="hidden" name="queue_id" value={q.id} />

                    <div className="grid gap-2 sm:grid-cols-2">
                      {(services ?? []).map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <span className="font-medium text-zinc-900 dark:text-zinc-50">{s.name}</span>
                          <input
                            type="checkbox"
                            name="service_ids"
                            value={s.id}
                            defaultChecked={selected.has(s.id)}
                            className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
