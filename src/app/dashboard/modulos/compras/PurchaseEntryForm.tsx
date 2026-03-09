"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PurchaseItemsEditor,
  createEmptyPurchaseRow,
  formatNumber,
  parseLooseNumber,
  type ProductOption,
  type PurchaseRowState,
} from "./PurchaseItemsEditor";
import { createPurchaseEntry } from "@/lib/merchant/purchaseActions";

type SupplierOption = {
  id: string;
  name: string;
};

type ImportedNfeItem = {
  productName: string;
  barcode: string | null;
  internalCode: string | null;
  quantity: number;
  unitCost: number;
};

type ImportedNfePayload = {
  invoiceNumber: string;
  issueDate: string | null;
  supplierName: string | null;
  items: ImportedNfeItem[];
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeCode(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function normalizeLooseCode(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function getFirstDescendantByLocalName(root: Element, localName: string): Element | null {
  const stack: Element[] = [root];
  const target = localName.toLowerCase();

  while (stack.length > 0) {
    const current = stack.shift()!;
    if ((current.localName || current.tagName).toLowerCase() === target) {
      return current;
    }
    stack.unshift(...Array.from(current.children));
  }

  return null;
}

function getText(root: Element, localName: string): string {
  const found = getFirstDescendantByLocalName(root, localName);
  return found?.textContent?.trim() ?? "";
}

function toInputDate(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  return null;
}

function parseNfeXml(xmlText: string): ImportedNfePayload {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const parseError = doc.getElementsByTagName("parsererror")[0];
  if (parseError) {
    throw new Error("xml_parse_error");
  }

  const nfeRoot = doc.documentElement;
  const invoiceNumber = getText(nfeRoot, "nNF");
  const issueDate = toInputDate(getText(nfeRoot, "dhEmi") || getText(nfeRoot, "dEmi"));
  const supplierName = getText(nfeRoot, "xNome") || null;

  const detElements = Array.from(doc.getElementsByTagName("det"));
  const fallbackDetElements = detElements.length > 0
    ? detElements
    : Array.from(doc.getElementsByTagNameNS("*", "det"));

  const items = fallbackDetElements
    .map((det) => {
      const prod = getFirstDescendantByLocalName(det, "prod");
      if (!prod) return null;

      const productName = getText(prod, "xProd");
      const barcode = normalizeCode(getText(prod, "cEAN") || getText(prod, "cEANTrib")) || null;
      const internalCode = normalizeLooseCode(getText(prod, "cProd")) || null;
      const quantity = Number(getText(prod, "qCom").replace(",", "."));
      const unitCost = Number(getText(prod, "vUnCom").replace(",", "."));

      if (!productName || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        return null;
      }

      return {
        productName,
        barcode,
        internalCode,
        quantity,
        unitCost,
      } satisfies ImportedNfeItem;
    })
    .filter((item): item is ImportedNfeItem => item != null);

  if (!invoiceNumber || items.length === 0) {
    throw new Error("xml_missing_data");
  }

  return {
    invoiceNumber,
    issueDate,
    supplierName,
    items,
  };
}

function buildImportedRows(items: ImportedNfeItem[], products: ProductOption[]): PurchaseRowState[] {
  const byBarcode = new Map<string, ProductOption>();
  const byInternalCode = new Map<string, ProductOption>();
  const normalizedProducts = products.map((product) => ({
    product,
    normalizedName: normalizeText(product.name),
  }));

  for (const product of products) {
    const barcode = normalizeCode(product.barcode);
    if (barcode) byBarcode.set(barcode, product);

    const internalCode = normalizeLooseCode(product.internalCode);
    if (internalCode) byInternalCode.set(internalCode, product);
  }

  return items.map((item) => {
    let matched: ProductOption | undefined;
    const barcode = normalizeCode(item.barcode);
    const internalCode = normalizeLooseCode(item.internalCode);

    if (barcode) matched = byBarcode.get(barcode);
    if (!matched && internalCode) matched = byInternalCode.get(internalCode);
    if (!matched) {
      const itemName = normalizeText(item.productName);
      matched = normalizedProducts.find(({ normalizedName }) => normalizedName === itemName)?.product;
    }
    if (!matched) {
      const itemName = normalizeText(item.productName);
      matched = normalizedProducts.find(({ normalizedName }) =>
        normalizedName.includes(itemName) || itemName.includes(normalizedName),
      )?.product;
    }

    return {
      ...createEmptyPurchaseRow(),
      productId: matched?.id ?? "",
      quantity: formatNumber(item.quantity, 3),
      unitCost: formatNumber(item.unitCost, 2),
      importedName: item.productName,
      importedBarcode: item.barcode,
      importedInternalCode: item.internalCode,
    } satisfies PurchaseRowState;
  });
}

function buildItemsJson(rows: PurchaseRowState[]): string {
  return JSON.stringify(
    rows
      .filter((row) => row.productId || row.quantity.trim() || row.unitCost.trim())
      .map((row) => ({
        product_id: row.productId,
        quantity: row.quantity,
        unit_cost: row.unitCost,
      })),
  );
}

export function PurchaseEntryForm({
  products,
  suppliers,
  today,
}: {
  products: ProductOption[];
  suppliers: SupplierOption[];
  today: string;
}) {
  const [rows, setRows] = useState<PurchaseRowState[]>([
    createEmptyPurchaseRow(),
    createEmptyPurchaseRow(),
    createEmptyPurchaseRow(),
  ]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [entryDate, setEntryDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [xmlBanner, setXmlBanner] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [xmlSummary, setXmlSummary] = useState<{ supplierName: string | null; invoiceNumber: string; itemCount: number } | null>(null);

  const itemsJson = useMemo(() => buildItemsJson(rows), [rows]);
  const total = useMemo(
    () => rows.reduce((sum, row) => sum + parseLooseNumber(row.quantity) * parseLooseNumber(row.unitCost), 0),
    [rows],
  );

  const unresolvedRows = rows.filter((row) => {
    const hasContent = row.productId || row.quantity.trim() || row.unitCost.trim() || row.importedName;
    return hasContent && !row.productId;
  });

  async function handleXmlImport(file: File): Promise<void> {
    const xmlText = await file.text();
    const imported = parseNfeXml(xmlText);
    const importedRows = buildImportedRows(imported.items, products);
    const normalizedSupplier = normalizeText(imported.supplierName ?? "");
    const matchedSupplier = suppliers.find((supplier) => normalizeText(supplier.name) === normalizedSupplier);

    setRows(importedRows.length > 0 ? importedRows : [createEmptyPurchaseRow()]);
    setInvoiceNumber(imported.invoiceNumber);
    if (imported.issueDate) setIssueDate(imported.issueDate);
    setEntryDate(today);
    setSupplierId(matchedSupplier?.id ?? "");
    setSupplierName(matchedSupplier ? "" : imported.supplierName ?? "");
    setXmlSummary({
      supplierName: imported.supplierName,
      invoiceNumber: imported.invoiceNumber,
      itemCount: imported.items.length,
    });

    const unmatched = importedRows.filter((row) => !row.productId).length;
    setXmlBanner(
      unmatched > 0
        ? {
            kind: "error",
            message: `XML importado com ${unmatched} item(ns) sem vínculo automático. Revise e selecione os produtos antes de confirmar.`,
          }
        : {
            kind: "success",
            message: "XML importado com sucesso. Nota, fornecedor e itens foram preenchidos automaticamente.",
          },
    );
  }

  return (
    <form action={createPurchaseEntry} className="mt-8 space-y-6">
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Importar XML da NF-e</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Envie o XML da nota para preencher automaticamente fornecedor, número, data e itens da compra.
            </p>

            <div className="mt-4 space-y-3">
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;

                  try {
                    await handleXmlImport(file);
                  } catch {
                    setXmlSummary(null);
                    setXmlBanner({
                      kind: "error",
                      message: "Não foi possível ler este XML. Verifique se é um arquivo de NF-e válido.",
                    });
                  } finally {
                    event.currentTarget.value = "";
                  }
                }}
                className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:file:bg-zinc-100 dark:file:text-zinc-900"
              />

              {xmlBanner ? (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    xmlBanner.kind === "error"
                      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  }`}
                >
                  {xmlBanner.message}
                </div>
              ) : null}

              {xmlSummary ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">XML carregado</p>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                    Nota {xmlSummary.invoiceNumber}
                    {xmlSummary.supplierName ? ` · ${xmlSummary.supplierName}` : ""}
                    {` · ${xmlSummary.itemCount} item(ns)`}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Dados da nota</h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Fornecedor existente</label>
                <select
                  name="supplier_id"
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="">Selecionar depois / usar nome abaixo</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Novo fornecedor (opcional)</label>
                <input
                  name="supplier_name"
                  type="text"
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  placeholder="Ex: Distribuidora Central"
                  className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Se preencher e o fornecedor não existir, ele será criado automaticamente.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Número da nota / referência</label>
                <input
                  name="invoice_number"
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  placeholder="Ex: 15482"
                  className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Data de emissão</label>
                  <input
                    name="issue_date"
                    type="date"
                    value={issueDate}
                    onChange={(event) => setIssueDate(event.target.value)}
                    className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Data de entrada</label>
                  <input
                    name="entry_date"
                    type="date"
                    value={entryDate}
                    onChange={(event) => setEntryDate(event.target.value)}
                    className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Observações</label>
                <textarea
                  name="notes"
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Observações da compra, vencimento, condição, conferência etc."
                  className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">Como essa importação funciona</p>
            <ul className="mt-3 space-y-2">
              <li>• lê XML da NF-e no navegador, sem depender de cola manual</li>
              <li>• tenta vincular itens por código de barras, código interno e nome</li>
              <li>• deixa você revisar itens sem vínculo antes de confirmar</li>
              <li>• ao salvar, atualiza estoque, custo da última compra e custo médio</li>
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <input type="hidden" name="items_json" value={itemsJson} />

          <PurchaseItemsEditor products={products} rows={rows} onRowsChange={setRows} />

          {unresolvedRows.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Existem {unresolvedRows.length} item(ns) sem produto vinculado. Selecione o produto correto antes de confirmar a entrada.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/50">
            <div>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Resumo da entrada</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Total estimado desta importação: {formatNumber(total, 2)}
              </p>
            </div>
            <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
              R$ {formatNumber(total, 2)}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Link
              href="/dashboard/modulos/estoque"
              className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Voltar ao estoque
            </Link>
            <button
              type="submit"
              disabled={unresolvedRows.length > 0}
              className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Confirmar entrada da compra
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
