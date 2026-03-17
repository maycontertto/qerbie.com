"use client";

import { useMemo, useState } from "react";
import { saveProductStockBatch } from "@/lib/merchant/stockActions";
import { BarcodeScannerField } from "@/app/dashboard/modulos/produtos/BarcodeScannerField";

type StockProduct = {
  id: string;
  name: string;
  barcode: string | null;
  isActive: boolean;
  trackStock: boolean;
  stockQuantity: number;
  price: number;
  costPrice: number;
};

type EditableRow = {
  id: string;
  name: string;
  barcode: string | null;
  isActive: boolean;
  trackStock: boolean;
  stockQuantity: string;
  price: string;
  costPrice: string;
};

function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function parseLooseNumber(value: string): number {
  const raw = value.trim();
  if (!raw) return 0;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function toEditableRow(product: StockProduct): EditableRow {
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    isActive: product.isActive,
    trackStock: product.trackStock,
    stockQuantity: formatNumber(product.stockQuantity, 3),
    price: formatNumber(product.price, 2),
    costPrice: formatNumber(product.costPrice, 2),
  };
}

export function EstoqueBulkEditor({ products }: { products: StockProduct[] }) {
  const [query, setQuery] = useState("");
  const [showOnlyTracked, setShowOnlyTracked] = useState(false);
  const [rows, setRows] = useState<EditableRow[]>(() => products.map(toEditableRow));

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (showOnlyTracked && !row.trackStock) return false;
      if (!normalizedQuery) return true;
      const barcode = String(row.barcode ?? "").toLocaleLowerCase("pt-BR");
      return (
        row.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery) ||
        barcode.includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, rows, showOnlyTracked]);

  const changedCount = useMemo(() => {
    const originalMap = new Map(products.map((product) => [product.id, product]));
    return rows.filter((row) => {
      const original = originalMap.get(row.id);
      if (!original) return false;
      return (
        row.trackStock !== original.trackStock ||
        parseLooseNumber(row.stockQuantity) !== original.stockQuantity ||
        parseLooseNumber(row.price) !== original.price ||
        parseLooseNumber(row.costPrice) !== original.costPrice
      );
    }).length;
  }, [products, rows]);

  const payload = useMemo(
    () =>
      JSON.stringify(
        rows.map((row) => ({
          product_id: row.id,
          track_stock: row.trackStock,
          stock_quantity: row.stockQuantity,
          price: row.price,
          cost_price: row.costPrice,
        })),
      ),
    [rows],
  );

  function updateRow(rowId: string, patch: Partial<EditableRow>): void {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  return (
    <form action={saveProductStockBatch} className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Edição em lote</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Atualize preço, custo, controle de estoque e quantidade de vários itens de uma vez.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          {changedCount} alteração(ões) pendente(s)
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <BarcodeScannerField
          label="Buscar item"
          value={query}
          onValueChange={setQuery}
          placeholder="Buscar por nome ou código de barras"
          helperText="A leitura pela câmera já filtra a grade pelo código encontrado."
        />

        <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={showOnlyTracked}
            onChange={(event) => setShowOnlyTracked(event.target.checked)}
            className="h-4 w-4"
          />
          Mostrar só itens com estoque
        </label>
      </div>

      <input type="hidden" name="items_json" value={payload} />

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="pb-3 pr-4">Item</th>
              <th className="pb-3 pr-4">Preço</th>
              <th className="pb-3 pr-4">Custo</th>
              <th className="pb-3 pr-4">Controla estoque</th>
              <th className="pb-3">Quantidade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {visibleRows.map((row) => (
              <tr key={row.id}>
                <td className="py-3 pr-4 align-top">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">{row.name}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {row.isActive ? "Ativo" : "Inativo"}
                      {row.barcode ? ` • ${row.barcode}` : ""}
                    </p>
                  </div>
                </td>
                <td className="py-3 pr-4 align-top">
                  <input
                    value={row.price}
                    onChange={(event) => updateRow(row.id, { price: event.target.value })}
                    inputMode="decimal"
                    className="w-28 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </td>
                <td className="py-3 pr-4 align-top">
                  <input
                    value={row.costPrice}
                    onChange={(event) => updateRow(row.id, { costPrice: event.target.value })}
                    inputMode="decimal"
                    className="w-28 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </td>
                <td className="py-3 pr-4 align-top">
                  <label className="flex items-center gap-2 pt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={row.trackStock}
                      onChange={(event) => updateRow(row.id, { trackStock: event.target.checked })}
                      className="h-4 w-4"
                    />
                    Sim
                  </label>
                </td>
                <td className="py-3 align-top">
                  <input
                    value={row.stockQuantity}
                    onChange={(event) => updateRow(row.id, { stockQuantity: event.target.value })}
                    inputMode="decimal"
                    disabled={!row.trackStock}
                    className="w-28 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleRows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          Nenhum item encontrado com esse filtro.
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Dica: esse atalho é ideal para reposição rápida, revisão de custos e atualização operacional do balcão.
        </p>
        <button
          type="submit"
          className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Salvar alterações em lote
        </button>
      </div>
    </form>
  );
}
