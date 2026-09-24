import Link from "next/link";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { supportsPurchaseEntries } from "@/lib/merchant/purchaseCategories";
import { decryptFiscalValue } from "@/lib/merchant/fiscalEncryption";
import { fetchReceivedInvoiceXml, syncReceivedInvoices } from "@/lib/merchant/brandingActions";
import { PurchaseEntryForm } from "../compras/PurchaseEntryForm";

export const maxDuration = 60;

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function ReceivedInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; invoice_synced?: string; invoice_error?: string; review_invoice?: string }>;
}) {
  const { user, merchant } = await getDashboardUserOrRedirect();
  const { saved, error, invoice_synced: invoiceSynced, invoice_error: invoiceError, review_invoice: reviewInvoiceId } = await searchParams;
  if (user.id !== merchant.owner_user_id) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="text-sm font-medium underline">← Voltar ao painel</Link>
        <h1 className="mt-4 text-2xl font-semibold">Notas recebidas</h1>
        <p className="mt-2 text-sm text-zinc-500">Somente o proprietário pode consultar notas e confirmar entradas no estoque.</p>
      </main>
    );
  }
  if (!supportsPurchaseEntries(merchant.business_category)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="text-sm font-medium underline">← Voltar ao painel</Link>
        <h1 className="mt-4 text-2xl font-semibold">Notas recebidas</h1>
        <p className="mt-2 text-sm text-zinc-500">Este módulo de entrada fiscal está disponível para mercados, farmácias, bares, restaurantes e açaíterias/sorveterias.</p>
      </main>
    );
  }

  const supabase = await createClient({}, { withAuth: true });
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: invoices }, { data: primaryMenu }, { data: products }, { data: suppliers }, { count: pendingInvoiceCount }, { count: enteredInvoiceCount }] = await Promise.all([
    supabase.from("merchant_received_invoices")
      .select("id, access_key, invoice_number, issuer_name, issued_at, total_amount, status, full_xml_ciphertext")
      .eq("merchant_id", merchant.id)
      .order("issued_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase.from("menus").select("id")
      .eq("merchant_id", merchant.id)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1).maybeSingle(),
    supabase.from("products")
      .select("id, name, barcode, internal_code, unit_label, stock_quantity, cost_price, is_active")
      .eq("merchant_id", merchant.id).eq("is_active", true).order("name", { ascending: true }),
    supabase.from("merchant_suppliers").select("id, name").eq("merchant_id", merchant.id).order("name", { ascending: true }),
    supabase.from("merchant_received_invoices").select("id", { count: "exact", head: true })
      .eq("merchant_id", merchant.id).in("status", ["available", "xml_requested", "ready_for_review"]),
    supabase.from("merchant_received_invoices").select("id", { count: "exact", head: true })
      .eq("merchant_id", merchant.id).eq("status", "entered"),
  ]);
  const { data: categories } = primaryMenu?.id
    ? await supabase.from("menu_categories").select("id, name")
        .eq("merchant_id", merchant.id).eq("menu_id", primaryMenu.id)
        .order("display_order", { ascending: true }).order("created_at", { ascending: true })
    : { data: [] as Array<{ id: string; name: string }> };

  const invoiceToReview = invoices?.find((invoice) => invoice.id === reviewInvoiceId);
  let reviewXml: string | null = null;
  if (invoiceToReview?.full_xml_ciphertext) {
    try { reviewXml = decryptFiscalValue(invoiceToReview.full_xml_ciphertext).toString("utf8"); }
    catch { reviewXml = null; }
  }
  const waitingCount = pendingInvoiceCount ?? 0;
  const enteredCount = enteredInvoiceCount ?? 0;
  const messages: Record<string, string> = {
    setup_required: "Cadastre o CPF/CNPJ e o certificado A1 em Marca (QR) para consultar notas.",
    query_wait: "A SEFAZ limita consultas repetidas. Aguarde até uma hora antes de consultar novamente.",
    owner_only: "Somente o proprietário pode consultar notas fiscais.",
    query_failed: "A consulta não foi concluída. Confira os dados fiscais e o certificado A1 em Marca (QR).",
    xml_unavailable: "A SEFAZ ainda não liberou o XML completo. Em alguns casos, o destinatário precisa registrar a manifestação fiscal aplicável no Portal NF-e antes de tentar novamente. Essa manifestação é separada da entrada no estoque.",
    already_entered: "Esta nota já foi lançada no estoque.",
  };
  const formErrorMessages: Record<string, string> = {
    invalid_items: "Confira os produtos, quantidades e custos da nota.",
    invalid_invoice_number: "Informe o número da nota fiscal.",
    invalid_invoice_access_key: "A chave de acesso da NF-e precisa ter 44 números válidos.",
    invalid_supplier: "O fornecedor selecionado não é válido.",
    invalid_product: "Um dos produtos selecionados não foi encontrado.",
    save_failed: "Não foi possível registrar a entrada. Tente novamente.",
    already_entered: "Esta nota já foi lançada no estoque e não pode ser confirmada novamente.",
    not_owner: "Somente o proprietário pode confirmar a entrada.",
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">← Voltar ao catálogo</Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Notas fiscais recebidas</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">As notas ficam aqui aguardando conferência. O estoque só é atualizado quando você revisa os produtos e confirma a entrada.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/dashboard/modulos/compras" className="font-medium underline">Compras manuais</Link>
          <Link href="/dashboard/modulos/estoque" className="font-medium underline">Estoque</Link>
        </div>
      </div>

      {saved === "1" && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Entrada confirmada. Os produtos e quantidades da nota foram lançados no estoque.</div>}
      {invoiceSynced === "1" && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Consulta concluída. As notas recebidas foram atualizadas nesta lista.</div>}
      {invoiceError && messages[invoiceError] && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{messages[invoiceError]}</div>}
      {error && formErrorMessages[error] && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{formErrorMessages[error]}</div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Aguardando entrada</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{waitingCount}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Entradas confirmadas</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{enteredCount}</p>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Caixa de notas fiscais</h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">As notas são buscadas para o CPF/CNPJ cadastrado. Consultar e baixar XML não movimenta o estoque.</p>
          </div>
          <form action={syncReceivedInvoices}>
            <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">Buscar novas notas</button>
          </form>
        </div>
        <div className="mt-5 space-y-3">
          {invoices?.length ? invoices.map((invoice) => (
            <article key={invoice.id} className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">NF-e {invoice.invoice_number ?? "(número indisponível)"}{invoice.issuer_name ? ` · ${invoice.issuer_name}` : ""}</p>
                  <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">Emitida em {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString("pt-BR") : "data indisponível"} · Chave {invoice.access_key}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${invoice.status === "entered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : invoice.status === "ready_for_review" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>
                    {invoice.status === "entered" ? "Entrada confirmada" : invoice.status === "ignored" ? "Ignorada" : invoice.status === "ready_for_review" ? "XML disponível · aguardando entrada" : "Aguardando entrada"}
                  </span>
                  {invoice.status === "entered" || invoice.status === "ignored" ? null : invoice.status === "ready_for_review" ? (
                    <Link href={`/dashboard/modulos/notas_fiscais?review_invoice=${invoice.id}`} className="text-xs font-semibold text-zinc-900 underline dark:text-zinc-100">Revisar e dar entrada</Link>
                  ) : (
                    <form action={fetchReceivedInvoiceXml.bind(null, invoice.id)}>
                      <button type="submit" className="text-xs font-semibold text-zinc-900 underline dark:text-zinc-100">Obter XML e revisar</button>
                    </form>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{invoice.total_amount === null ? "Total indisponível" : formatBrl(Number(invoice.total_amount))}</p>
            </article>
          )) : <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma nota localizada. Configure os dados fiscais em <Link href="/dashboard/branding" className="font-medium underline">Marca (QR)</Link> e busque notas.</p>}
        </div>
      </section>

      {reviewXml && invoiceToReview && (
        <section className="mt-8 rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-5 dark:border-blue-900 dark:bg-blue-950/30">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Conferir NF-e {invoiceToReview.invoice_number ?? ""}{invoiceToReview.issuer_name ? ` · ${invoiceToReview.issuer_name}` : ""}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Confira os produtos vinculados, quantidades e custos. O estoque permanece intacto até você usar o botão de confirmação no fim do formulário.</p>
          {products?.length ? (
            <PurchaseEntryForm
              today={today}
              categories={(categories ?? []).map((category) => ({ id: category.id, name: category.name }))}
              suppliers={(suppliers ?? []).map((supplier) => ({ id: supplier.id, name: supplier.name }))}
              initialInvoiceXml={reviewXml}
              initialInvoiceAccessKey={invoiceToReview.access_key}
              initialInvoiceId={invoiceToReview.id}
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
            <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              Cadastre os produtos do negócio antes de revisar os itens da nota. <Link href="/dashboard/modulos/produtos" className="font-semibold underline">Abrir cadastro de produtos</Link>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
