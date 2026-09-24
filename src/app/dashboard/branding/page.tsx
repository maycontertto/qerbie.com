import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { getBusinessCategoryLabel } from "@/lib/merchant/helpers";
import { DashboardShell } from "../DashboardShell";
import { saveFiscalCertificate, saveFiscalTaxId, updateBranding, uploadBrandLogo } from "@/lib/merchant/brandingActions";
import { createClient } from "@/lib/supabase/server";
import { decryptFiscalValue, maskTaxId } from "@/lib/merchant/fiscalEncryption";

export default async function BrandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; fiscal_error?: string; fiscal_saved?: string }>;
}) {
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const { error, saved, fiscal_error: fiscalError, fiscal_saved: fiscalSaved } = await searchParams;

  const isOwner = user.id === merchant.owner_user_id;
  const canBranding =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_branding")
      : false);
  const selectedKey = merchant.business_category ?? null;
  const selectedLabel = getBusinessCategoryLabel(selectedKey);
  let fiscalProfile: { maskedTaxId: string | null; hasCertificate: boolean } = { maskedTaxId: null, hasCertificate: false };
  if (isOwner) {
    const supabase = await createClient({}, { withAuth: true });
    const { data } = await supabase.from("merchant_fiscal_profiles")
      .select("tax_id_ciphertext, certificate_ciphertext")
      .eq("merchant_id", merchant.id)
      .maybeSingle();
    if (data) {
      try {
        fiscalProfile = {
          maskedTaxId: data.tax_id_ciphertext ? maskTaxId(decryptFiscalValue(data.tax_id_ciphertext).toString("utf8")) : null,
          hasCertificate: Boolean(data.certificate_ciphertext),
        };
      } catch { /* never expose ciphertext or decryption details in the page */ }
    }
  }

  if (!canBranding) {
    return (
      <DashboardShell
        merchantName={merchant.name}
        userEmail={user.email ?? ""}
        selectedLabel={selectedLabel}
        selectedKey={selectedKey}
        isOwner={isOwner}
        canBranding={canBranding}
      >
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
      </DashboardShell>
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

  const fiscalErrorMessages: Record<string, string> = {
    owner_only: "Somente o proprietário pode alterar os dados fiscais.",
    invalid_tax_id: "CPF ou CNPJ inválido. Confira os números e tente novamente.",
    save_failed: "Não foi possível salvar os dados fiscais.",
    encryption_key_missing: "A proteção dos dados fiscais ainda não foi configurada no servidor.",
    certificate_missing: "Selecione o certificado A1.",
    certificate_too_large: "O arquivo do certificado deve ter até 750 KB.",
    certificate_type: "Envie o certificado A1 no formato .pfx ou .p12.",
    certificate_password: "Informe a senha do certificado (até 256 caracteres).",
    tax_id_required: "Salve o CPF/CNPJ antes de enviar o certificado.",
  };

  return (
    <DashboardShell
      merchantName={merchant.name}
      userEmail={user.email ?? ""}
      selectedLabel={selectedLabel}
      selectedKey={selectedKey}
      isOwner={isOwner}
      canBranding={canBranding}
    >
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

          {isOwner && (fiscalError || fiscalSaved) && (
            <div className={`mt-6 rounded-lg border p-3 text-sm ${fiscalError ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}>
              {fiscalError ? (fiscalErrorMessages[fiscalError] ?? "Não foi possível salvar os dados fiscais.") : "Dados fiscais salvos com proteção."}
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

          {isOwner && (
            <section className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Dados fiscais e consulta de notas</h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
                Opcional para negócios formais e informais. CPF/CNPJ e certificado são privados e não aparecem na marca ou no QR Code. Notas encontradas serão apresentadas para revisão; o estoque só muda quando você confirmar a entrada.
              </p>
              <form action={saveFiscalTaxId} className="mt-5 space-y-3">
                <div>
                  <label htmlFor="tax_id" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">CPF ou CNPJ do destinatário</label>
                  <input id="tax_id" name="tax_id" type="text" autoComplete="off" placeholder="CPF ou CNPJ (com letras, se aplicável)" className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{fiscalProfile.maskedTaxId ? `Cadastrado: ${fiscalProfile.maskedTaxId}. Digite outro para substituir ou deixe em branco para remover.` : "O documento será cifrado antes de ser salvo."}</p>
                </div>
                <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">Salvar documento fiscal</button>
              </form>
              <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Certificado digital A1 {fiscalProfile.hasCertificate ? "· cadastrado" : "· não cadastrado"}</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Envie o arquivo .pfx/.p12 (até 750 KB) e a senha para habilitar a consulta oficial de NF-e. O arquivo e a senha são cifrados separadamente e nunca são exibidos novamente.</p>
                <form action={saveFiscalCertificate} encType="multipart/form-data" className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input name="certificate_file" type="file" accept=".pfx,.p12,application/x-pkcs12" required className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium dark:text-zinc-300 dark:file:bg-zinc-800" />
                  <input name="certificate_password" type="password" autoComplete="new-password" required placeholder="Senha do certificado A1" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                  <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">Salvar certificado</button>
                </form>
              </div>
            </section>
          )}

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
    </DashboardShell>
  );
}
