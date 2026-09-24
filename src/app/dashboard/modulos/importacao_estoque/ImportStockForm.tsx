"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { importProductsSpreadsheet } from "@/lib/catalog/actions";

type ExistingProduct = { name: string; barcode: string | null; internalCode: string | null };
type PreviewRow = { name: string; barcode: string; category: string; price: string; stock: string };

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function field(row: Record<string, unknown>, ...names: string[]): string {
  const values = new Map(Object.entries(row).map(([key, value]) => [normalize(key).replace(/\s+/g, "_"), String(value ?? "").trim()]));
  for (const name of names) {
    const value = values.get(name);
    if (value) return value;
  }
  return "";
}

export function ImportStockForm({
  menuId,
  defaultCategoryId,
  returnTo,
  existingProducts,
}: {
  menuId: string;
  defaultCategoryId: string;
  returnTo: string;
  existingProducts: ExistingProduct[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [invalidRows, setInvalidRows] = useState(0);
  const [previewError, setPreviewError] = useState("");
  const [mode, setMode] = useState("create_update");

  const existingIndex = useMemo(() => {
    const barcodes = new Set(existingProducts.flatMap((product) => product.barcode ? [product.barcode] : []));
    const names = new Set(existingProducts.map((product) => normalize(product.name)));
    return { barcodes, names };
  }, [existingProducts]);

  const matchingRows = previewRows.filter((row) =>
    (row.barcode && existingIndex.barcodes.has(row.barcode)) || existingIndex.names.has(normalize(row.name)),
  ).length;

  async function preparePreview(nextFile: File | null) {
    setFile(nextFile);
    setPreviewRows([]);
    setTotalRows(0);
    setInvalidRows(0);
    setPreviewError("");
    if (!nextFile) return;
    if (nextFile.size > 15 * 1024 * 1024) {
      setPreviewError("O arquivo deve ter até 15 MB.");
      return;
    }

    try {
      const bytes = new Uint8Array(await nextFile.arrayBuffer());
      const workbook = XLSX.read(bytes, { type: "array" });
      const firstSheet = workbook.SheetNames[0] ? workbook.Sheets[workbook.SheetNames[0]] : null;
      if (!firstSheet) throw new Error("empty_sheet");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "", raw: false });
      const normalizedRows = rows.map((row) => ({
        name: field(row, "nome", "produto", "item", "name"),
        barcode: field(row, "codigo_de_barras", "codigo_barras", "barcode", "ean"),
        internalCode: field(row, "codigo_interno", "internal_code", "sku"),
        category: field(row, "categoria", "category", "grupo"),
        price: field(row, "preco", "preco_de_venda", "price", "valor"),
        stock: field(row, "estoque", "quantidade", "stock", "qty"),
      }));
      const importableRows = normalizedRows.filter((row) => row.name.length >= 2 || row.barcode || row.internalCode);
      setTotalRows(importableRows.length);
      setInvalidRows(importableRows.filter((row) => row.name.length < 2).length);
      setPreviewRows(importableRows.slice(0, 10));
      if (!importableRows.length) setPreviewError("Não encontrei linhas com produto. Confira se a primeira linha contém os cabeçalhos.");
    } catch {
      setPreviewError("Não consegui ler essa planilha. Use o modelo XLSX ou salve o arquivo como CSV.");
    }
  }

  return (
    <form action={importProductsSpreadsheet} className="space-y-6" encType="multipart/form-data">
      <input type="hidden" name="menu_id" value={menuId} />
      <input type="hidden" name="redirect_to" value="/dashboard/modulos/importacao_estoque" />
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="default_category_id" value={defaultCategoryId} />
      <input type="hidden" name="import_mode" value={mode} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100">Planilha de produtos</label>
          <input
            name="spreadsheet_file"
            type="file"
            required
            accept=".csv,.xlsx,.xls"
            onChange={(event) => void preparePreview(event.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500 dark:text-zinc-300"
          />
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Aceita XLSX, XLS e CSV de até 15 MB.</p>
          {previewError ? <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">{previewError}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100">O que fazer com produtos já cadastrados</label>
          <select value={mode} onChange={(event) => setMode(event.target.value)} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800">
            <option value="create_update">Criar novos e atualizar correspondentes</option>
            <option value="create_only">Importar somente produtos novos</option>
            <option value="update_only">Atualizar somente os existentes</option>
          </select>
        </div>
      </div>

      {totalRows > 0 ? (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800" aria-live="polite">
          <div className="grid gap-3 border-b border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div><p className="text-xs text-zinc-500">Linhas reconhecidas</p><p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{totalRows}</p></div>
            <div><p className="text-xs text-zinc-500">Correspondem a produtos existentes na amostra</p><p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{matchingRows}</p></div>
            <div><p className="text-xs text-zinc-500">Sem nome válido e que serão ignoradas</p><p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{invalidRows}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Código de barras</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Preço</th><th className="px-4 py-3">Estoque</th></tr></thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {previewRows.slice(0, 8).map((row, index) => <tr key={`${row.name}-${index}`}><td className="max-w-64 truncate px-4 py-3 font-medium text-zinc-800 dark:text-zinc-100">{row.name || <span className="text-red-600">Nome ausente</span>}</td><td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{row.barcode || "—"}</td><td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{row.category || "—"}</td><td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{row.price || "—"}</td><td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{row.stock || "—"}</td></tr>)}
              </tbody>
            </table>
          </div>
          {totalRows > 8 ? <p className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800">Prévia das primeiras 8 linhas de {totalRows}. A planilha completa será processada ao confirmar.</p> : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <p className="max-w-2xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">Categorias ausentes serão criadas automaticamente. A prévia é local; ao confirmar, a planilha será enviada para importação. Esta etapa importa cadastro e saldo inicial, sem lançar notas fiscais.</p>
        <button type="submit" disabled={!file || totalRows === 0 || Boolean(previewError)} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">Confirmar importação</button>
      </div>
    </form>
  );
}
