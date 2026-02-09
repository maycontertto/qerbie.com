import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { saveSupportContact } from "@/lib/merchant/supportActions";

export default async function SuporteModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canSupport =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_support")
      : false);

  if (!canSupport) {
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
              Suporte
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

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
            Suporte &amp; Contato
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Configure WhatsApp, horário e outros contatos visíveis para o cliente.
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

        <form action={saveSupportContact} className="mt-6 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Link do WhatsApp
            </label>
            <input
              name="support_whatsapp_url"
              inputMode="url"
              placeholder="https://wa.me/5599999999999"
              defaultValue={merchant.support_whatsapp_url ?? ""}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Precisa começar com http/https.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Horário de atendimento
              </label>
              <input
                name="support_hours"
                placeholder="Ex: Seg a Sex, 08:00 às 18:00"
                defaultValue={merchant.support_hours ?? ""}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                E-mail (opcional)
              </label>
              <input
                name="support_email"
                inputMode="email"
                placeholder="contato@empresa.com"
                defaultValue={merchant.support_email ?? ""}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Telefone (opcional)
            </label>
            <input
              name="support_phone"
              inputMode="tel"
              placeholder="(99) 99999-9999"
              defaultValue={merchant.support_phone ?? ""}
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
