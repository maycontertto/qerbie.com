import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { saveDeliverySettings } from "@/lib/merchant/deliveryActions";

export default async function EntregaModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canDelivery =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_delivery")
      : false);

  if (!canDelivery) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <a
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </a>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Entrega
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const enabled = Boolean(merchant.delivery_enabled);
  const fee = merchant.delivery_fee;
  const note = merchant.delivery_note ?? "";
  const eta = merchant.delivery_eta_minutes;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div>
          <a
            href="/dashboard"
            className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            ← Voltar ao painel
          </a>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Entrega
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Ative/desative, defina taxa fixa (opcional) e tempo estimado.
          </p>
        </div>

        {saved === "1" && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            Configurações salvas.
          </div>
        )}

        {error === "save_failed" && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            Não foi possível salvar agora. Tente novamente.
          </div>
        )}

        <form action={saveDeliverySettings} className="mt-6 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <label className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Ativar entrega
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Quando desativado, o cliente não verá a opção de entrega.
                </p>
              </div>
              <input
                type="checkbox"
                name="delivery_enabled"
                defaultChecked={enabled}
                className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Taxa fixa de entrega (opcional)
              </label>
              <input
                name="delivery_fee"
                inputMode="decimal"
                placeholder="Ex: 5,00"
                defaultValue={fee != null ? String(fee).replace(".", ",") : ""}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Se vazio, será R$ 0,00.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Tempo estimado (minutos)
              </label>
              <input
                name="delivery_eta_minutes"
                inputMode="numeric"
                placeholder="Ex: 40"
                defaultValue={eta != null ? String(eta) : ""}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Opcional. Mostrado para o cliente.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Observação de entrega para o cliente
            </label>
            <textarea
              name="delivery_note"
              rows={4}
              placeholder="Ex: Entregamos até 22h. Pagamento na entrega."
              defaultValue={note}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              className="rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Salvar
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
