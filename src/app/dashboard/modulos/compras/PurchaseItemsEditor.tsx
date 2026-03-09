"use client";

import { useMemo, useState } from "react";

type ProductOption = {
  id: string;
  name: string;
  barcode: string | null;
  unitLabel: string;
  stockQuantity: number;
  costPrice: number;
};

type RowState = {
  key: string;
  productId: string;
  quantity: string;
  unitCost: string;
};

function newRow(): RowState {
  return {
    key: Math.random().toString(36).slice(2, 10),
    productId: "",
    quantity: "",
    unitCost: "",
  };
}

function parseLooseNumber(value: string): number {
  const raw = value.trim();
  if (!raw) return 0;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function PurchaseItemsEditor({ products }: { products: ProductOption[] }) {
  const [rows, setRows] = useState<RowState[]>([newRow(), newRow(), newRow()]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const payload = JSON.stringify(
    rows
      .filter((row) => row.productId || row.quantity.trim() || row.unitCost.trim())
      .map((row) => ({
        product_id: row.productId,
        quantity: row.quantity,
        unit_cost: row.unitCost,
      })),
  );

  const total = rows.reduce((sum, row) => {
    const qty = parseLooseNumber(row.quantity);
    const unitCost = parseLooseNumber(row.unitCost);
    return sum + qty * unitCost;
  }, 0);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Itens da compra</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Lance vários produtos de uma vez. Ao confirmar, o estoque será atualizado em lote.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRows((current) => [...current, newRow()])}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          + Adicionar item
        </button>
      </div>

      <input type="hidden" name="items_json" value={payload} />

      <div className="mt-5 space-y-3">
        {rows.map((row, index) => {
          const product = productMap.get(row.productId);
          const qty = parseLooseNumber(row.quantity);
          const unitCost = parseLooseNumber(row.unitCost);
          const lineTotal = qty * unitCost;

          return (
            <div
              key={row.key}
              className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_150px_150px_auto]">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Produto #{index + 1}
                  </label>
                  <select
                    value={row.productId}
                    onChange={(event) => {
                      const nextProductId = event.target.value;
                      const nextProduct = productMap.get(nextProductId);
                      setRows((current) =>
                        current.map((item) =>
                          item.key === row.key
                            ? {
                                ...item,
                                productId: nextProductId,
                                unitCost:
                                  item.unitCost || !nextProduct
                                    ? item.unitCost
                                    : formatNumber(nextProduct.costPrice || 0, 2),
                              }
                            : item,
                        ),
                      );
                    }}
                    className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    <option value="">Selecione um produto</option>
                    {products.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                        {option.barcode ? ` · cód. ${option.barcode}` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>Unidade: {product?.unitLabel ?? "—"}</span>
                    <span>Estoque atual: {product ? formatNumber(product.stockQuantity, 3) : "—"}</span>
                    <span>Custo atual: {product ? `R$ ${formatNumber(product.costPrice, 2)}` : "—"}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Quantidade
                  </label>
                  <input
                    value={row.quantity}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setRows((current) => current.map((item) => (item.key === row.key ? { ...item, quantity: nextValue } : item)));
                    }}
                    placeholder="0,000"
                    inputMode="decimal"
                    className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Custo unitário
                  </label>
                  <input
                    value={row.unitCost}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setRows((current) => current.map((item) => (item.key === row.key ? { ...item, unitCost: nextValue } : item)));
                    }}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>

                <div className="flex items-end justify-between gap-3 lg:block">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Total
                    </p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      R$ {formatNumber(lineTotal, 2)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows((current) => (current.length > 1 ? current.filter((item) => item.key !== row.key) : current))}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900/70"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/50">
        <div>
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Resumo da entrada</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            O lançamento atualiza estoque, custo da última compra e custo médio dos itens selecionados.
          </p>
        </div>
        <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
          Total: R$ {formatNumber(total, 2)}
        </p>
      </div>
    </div>
  );
}
