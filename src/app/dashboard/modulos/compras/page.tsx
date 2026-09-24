import Link from "next/link";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { supportsPurchaseEntries } from "@/lib/merchant/purchaseCategories";
import { PurchaseEntryForm } from "./PurchaseEntryForm";
import { fetchReceivedInvoiceXml, syncReceivedInvoices } from "@/lib/merchant/brandingActions";
import { decryptFiscalValue } from "@/lib/merchant/fiscalEncryption";

export const maxDuration = 60;

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function ComprasModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; invoice_synced?: string; invoice_error?: string; review_invoice?: string }>;
}) {
  const { saved, error, invoice_synced: invoiceSynced, invoice_error: invoiceError, review_invoice: reviewInvoiceId } = await searchParams;
  const { user, merchant } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;

  if (!isOwner) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Compras</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Apenas o proprietário pode lançar entradas de nota e atualizar custo/estoque em lote.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!supportsPurchaseEntries(merchant.business_category)) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Compras</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Este módulo está disponível para mercados e açaíterias/sorveterias. Depois podemos expandir para outros segmentos.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient({}, { withAuth: true });
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: primaryMenu }, { data: products }, { data: suppliers }, { data: recentEntries }, { data: receivedInvoices }] = await Promise.all([
    supabase
      .from("menus")
      .select("id")
      .eq("merchant_id", merchant.id)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id, name, barcode, internal_code, unit_label, stock_quantity, cost_price, is_active")
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("merchant_suppliers")
      .select("id, name")
      .eq("merchant_id", merchant.id)
      .order("name", { ascending: true }),
    supabase
      .from("purchase_entries")
      .select("id, invoice_number, invoice_access_key, supplier_name, entry_date, item_count, total_amount, created_at")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("merchant_received_invoices")
      .select("id, access_key, invoice_number, issuer_name, issued_at, total_amount, status, first_seen_at, full_xml_ciphertext")
      .eq("merchant_id", merchant.id)
      .order("issued_at", { ascending: false, nullsFirst: false })
      .limit(30),
  ]);

  const { data: categories } = primaryMenu?.id
    ? await supabase
        .from("menu_categories")
        .select("id, name")
        .eq("merchant_id", merchant.id)
        .eq("menu_id", primaryMenu.id)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [] as Array<{ id: string; name: string }> };

  const banner =
    saved === "1"
      ? { kind: "success" as const, message: "Compra lançada e estoque atualizado com sucesso." }
      : error === "invalid_items"
        ? { kind: "error" as const, message: "Confira os itens da nota. Cada linha precisa ter produto, quantidade e custo." }
        : error === "invalid_invoice_number"
          ? { kind: "error" as const, message: "Informe o número da nota ou uma referência da compra." }
          : error === "invalid_invoice_access_key"
            ? { kind: "error" as const, message: "A chave de acesso da NF-e deve ter 44 números válidos." }
          : error === "invalid_supplier"
            ? { kind: "error" as const, message: "Fornecedor inválido." }
            : error === "invalid_product"
              ? { kind: "error" as const, message: "Um dos produtos informados não foi encontrado." }
              : error === "unsupported_category"
                ? { kind: "error" as const, message: "Este módulo ainda não está disponível para esse tipo de negócio." }
                : error === "not_owner"
                  ? { kind: "error" as const, message: "Somente o proprietário pode confirmar entradas de compra." }
          : error === "already_entered"
            ? { kind: "error" as const, message: "Esta nota já foi lançada no estoque e não pode ser confirmada novamente." }
          : error === "save_failed"
                    ? { kind: "error" as const, message: "Não foi possível registrar a compra agora. Tente novamente." }
                    : null;

  const invoiceBanner = invoiceSynced === "1"
    ? { kind: "success" as const, message: "Consulta concluída. Os resumos das notas recebidas foram atualizados." }
    : invoiceError === "setup_required"
      ? { kind: "error" as const, message: "Cadastre o CPF/CNPJ do destinatário e o certificado A1 em Marca (QR) para consultar notas." }
      : invoiceError === "query_wait"
        ? { kind: "error" as const, message: "A SEFAZ limita consultas repetidas. Aguarde até uma hora antes de consultar novamente." }
        : invoiceError === "owner_only"
          ? { kind: "error" as const, message: "Somente o proprietário pode consultar notas fiscais." }
          : invoiceError === "query_failed"
            ? { kind: "error" as const, message: "A consulta não foi concluída. Confira CPF/CNPJ, certificado A1 e senha em Marca (QR)." }
            : invoiceError === "xml_unavailable"
              ? { kind: "error" as const, message: "A SEFAZ ainda não liberou o XML completo. Em alguns casos, o destinatário precisa registrar a manifestação fiscal aplicável no Portal NF-e antes de tentar novamente. Essa manifestação é separada da entrada de estoque." }
              : invoiceError === "already_entered"
                ? { kind: "error" as const, message: "Esta nota já foi lançada no estoque." }
            : null;

  const selectedInvoice = receivedInvoices?.find((invoice) => invoice.id === reviewInvoiceId);
  let reviewInvoiceXml: string | null = null;
  if (selectedInvoice?.full_xml_ciphertext) {
    try { reviewInvoiceXml = decryptFiscalValue(selectedInvoice.full_xml_ciphertext).toString("utf8"); }
    catch { reviewInvoiceXml = null; }
  }

  const totalRecent = (recentEntries ?? []).reduce((sum, entry) => sum + Number(entry.total_amount ?? 0), 0);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Compras / entrada de nota</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
              Lance a compra completa de uma vez para atualizar o estoque, registrar a nota e guardar o custo mais recente dos produtos.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/dashboard/modulos/produtos" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              Produtos
            </Link>
            <Link href="/dashboard/modulos/estoque" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              Estoque
            </Link>
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

        {invoiceBanner && (
          <div className={`mt-4 rounded-2xl border p-4 text-sm ${invoiceBanner.kind === "error" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"}`}>
            {invoiceBanner.message}
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Produtos ativos</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{products?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Fornecedores cadastrados</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{suppliers?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Últimas entradas</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{formatBrl(totalRecent)}</p>
          </div>
        </div>

        {products?.length ? (
          <PurchaseEntryForm
            today={today}
            categories={(categories ?? []).map((category) => ({ id: category.id, name: category.name }))}
            suppliers={(suppliers ?? []).map((supplier) => ({ id: supplier.id, name: supplier.name }))}
            initialInvoiceXml={reviewInvoiceXml}
            initialInvoiceAccessKey={selectedInvoice?.access_key ?? null}
            initialInvoiceId={reviewInvoiceXml ? selectedInvoice?.id ?? null : null}
            products={(products ?? []).map((product) => ({
              id: product.id,
              name: product.name,
              barcode: (product as { barcode?: string | null }).barcode ?? null,
              internalCode: (product as { internal_code?: string | null }).internal_code ?? null,
              unitLabel: String((product as { unit_label?: string | null }).unit_label ?? "un"),
              stockQuantity: Number((product as { stock_quantity?: number | null }).stock_quantity ?? 0),
              costPrice: Number((product as { cost_price?: number | null }).cost_price ?? 0),
            }))}
          />
        ) : (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Cadastre produtos primeiro</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Para lançar a nota completa, o ideal é que os produtos já estejam no catálogo. Depois a entrada atualiza tudo em lote.
            </p>
            <Link href="/dashboard/modulos/produtos" className="mt-4 inline-flex text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
              Ir para Produtos
            </Link>
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Últimas compras lançadas</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Histórico rápido das entradas registradas no seu negócio.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {recentEntries?.length ? (
              recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Nota {entry.invoice_number}
                      {entry.supplier_name ? ` · ${entry.supplier_name}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Entrada em {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString("pt-BR") : "—"}
                      {` · ${entry.item_count ?? 0} item(ns)`}
                    </p>
                    {entry.invoice_access_key ? (
                      <p className="mt-1 break-all text-[11px] text-zinc-400 dark:text-zinc-500">
                        Chave NF-e: {entry.invoice_access_key}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatBrl(Number(entry.total_amount ?? 0))}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma compra lançada ainda.</p>
            )}
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Notas recebidas</h2>
              <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">Notas localizadas para o CPF/CNPJ cadastrado. A busca não altera o estoque. Cada entrada exige revisão e confirmação do proprietário.</p>
            </div>
            <form action={syncReceivedInvoices}>
              <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">Buscar novas notas</button>
            </form>
          </div>
          <div className="mt-5 space-y-3">
            {receivedInvoices?.length ? receivedInvoices.map((invoice) => (
              <article key={invoice.id} className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">NF-e {invoice.invoice_number ?? "(número indisponível)"}{invoice.issuer_name ? ` · ${invoice.issuer_name}` : ""}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Emitida em {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString("pt-BR") : "data indisponível"} · Chave {invoice.access_key}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">A busca e a obtenção do XML não alteram o estoque. Os itens serão carregados para revisão e só entram após a confirmação do proprietário.</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${invoice.status === "entered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : invoice.status === "ready_for_review" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>
                      {invoice.status === "entered" ? "Entrada confirmada" : invoice.status === "ready_for_review" ? "XML disponível" : "Aguardando conferência"}
                    </span>
                    {invoice.status === "entered" ? null : invoice.status === "ready_for_review" ? (
                      <Link href={`/dashboard/modulos/compras?review_invoice=${invoice.id}`} className="text-xs font-semibold text-zinc-900 underline dark:text-zinc-100">Revisar produtos</Link>
                    ) : (
                      <form action={fetchReceivedInvoiceXml.bind(null, invoice.id)}>
                        <button type="submit" className="text-xs font-semibold text-zinc-900 underline dark:text-zinc-100">Obter XML para conferência</button>
                      </form>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{invoice.total_amount === null ? "Total indisponível" : formatBrl(Number(invoice.total_amount))}</p>
              </article>
            )) : <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma nota localizada ainda. Configure os dados fiscais em <Link href="/dashboard/branding" className="font-medium underline">Marca (QR)</Link> e inicie uma busca.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
