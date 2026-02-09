import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { updateBranding, uploadBrandLogo } from "@/lib/merchant/brandingActions";

export default async function BrandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const { error, saved } = await searchParams;

  const isOwner = user.id === merchant.owner_user_id;
  const canBranding =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_branding")
      : false);

  if (!canBranding) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <a
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </a>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Marca (QR)
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const canEdit = canBranding;

  const banner =
    error === "not_allowed"
      ? {
          kind: "error" as const,
          message: "Você não tem permissão para alterar a marca.",
        }
      : error === "logo_missing"
        ? {
            kind: "error" as const,
            message: "Selecione um arquivo de imagem para o logo.",
          }
        : error === "logo_type"
          ? {
              kind: "error" as const,
              message: "Arquivo inválido. Envie uma imagem (PNG/JPG/etc).",
            }
          : error === "logo_too_large"
            ? {
                kind: "error" as const,
                message: "Imagem muito grande. Tente uma menor (máx. 5MB).",
              }
            : error === "bucket_missing"
              ? {
                  kind: "error" as const,
                  message:
                    "Bucket de storage não encontrado. Aplique a migração 020 no Supabase (brand-logos).",
                }
              : error === "logo_upload_failed"
                ? {
                    kind: "error" as const,
                    message: "Não foi possível enviar o logo agora.",
                  }
      : error === "invalid_color"
        ? {
            kind: "error" as const,
            message: "Cor inválida. Use o formato #RRGGBB.",
          }
        : error === "save_failed"
          ? {
              kind: "error" as const,
              message:
                "Não foi possível salvar agora. (Se você ainda não aplicou a migração 014 no Supabase, isso é esperado.)",
            }
          : saved
            ? { kind: "success" as const, message: "Marca salva." }
            : null;

  return (
    <div className="min-h-[calc(100dvh-0px)] bg-gradient-to-b from-white via-white to-zinc-50/80 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/40">
      <div className="pointer-events-none absolute inset-x-0 top-[-120px] mx-auto h-[320px] w-[720px] rounded-full bg-gradient-to-r from-indigo-500/15 via-fuchsia-500/10 to-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-[-140px] top-[120px] h-[260px] w-[260px] rounded-full bg-emerald-400/10 blur-3xl" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Marca (QR)
              </h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Isso aparece para o cliente quando ele lê o QR Code (tipo iFood:
                “você está sendo atendido por ...”).
              </p>
            </div>
            <a
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </a>
          </div>

          {banner && (
            <div
              className={`mt-6 rounded-lg border p-3 text-sm ${
                banner.kind === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              {banner.message}
            </div>
          )}

          {!canEdit && (
            <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              Você pode ver, mas não alterar.
            </div>
          )}

          <form action={updateBranding} className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nome exibido
              </label>
              <input
                name="display_name"
                type="text"
                defaultValue={merchant.brand_display_name ?? ""}
                placeholder={merchant.name}
                disabled={!canEdit}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Se vazio, usamos o nome do merchant.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Logo (URL)
              </label>
              <input
                name="logo_url"
                type="url"
                defaultValue={merchant.brand_logo_url ?? ""}
                placeholder="https://.../logo.png"
                disabled={!canEdit}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Dica: você também pode enviar um arquivo logo abaixo.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Mensagem de boas-vindas
              </label>
              <textarea
                name="welcome_message"
                defaultValue={merchant.customer_welcome_message ?? ""}
                placeholder="Ex: Bem-vindo! É um prazer te atender."
                disabled={!canEdit}
                rows={3}
                className="mt-1 block w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Aparece para o cliente quando ele abre o QR.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Cor principal
              </label>
              <input
                name="primary_color"
                type="text"
                defaultValue={merchant.brand_primary_color ?? ""}
                placeholder="#111827"
                disabled={!canEdit}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Formato: #RRGGBB (ex: #22c55e).
              </p>
            </div>

            <button
              type="submit"
              disabled={!canEdit}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Salvar
            </button>
          </form>

          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Enviar logo do aparelho
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Envia a imagem para o Supabase Storage e atualiza o logo automaticamente.
            </p>

            <form
              action={uploadBrandLogo}
              encType="multipart/form-data"
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Arquivo
                </label>
                <input
                  name="logo_file"
                  type="file"
                  accept="image/*"
                  disabled={!canEdit}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:file:bg-zinc-700 dark:file:text-zinc-100 dark:hover:file:bg-zinc-600"
                />
              </div>

              <button
                type="submit"
                disabled={!canEdit}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
