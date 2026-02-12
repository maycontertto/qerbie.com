"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function CaixaClient() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [barcode, setBarcode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "pix" | "card" | "other">("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [status, setStatus] = useState<{ kind: "idle" | "error" | "success"; message?: string }>({
    kind: "idle",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const total = useMemo(() => {
    return cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  }, [cart]);

  async function addByBarcode(raw: string) {
    const code = raw.trim();
    if (!code) return;

    setBusy(true);
    setStatus({ kind: "idle" });

    try {
      const res = await fetch(`/api/dashboard/caixa/lookup?barcode=${encodeURIComponent(code)}`);
      const json = (await res.json()) as
        | { ok: true; product: { id: string; name: string; price: number } }
        | { error: string; detail?: string };

      if (!res.ok || !("ok" in json)) {
        const msg = "error" in json && json.error === "not_found" ? "Item não encontrado." : "Falha ao buscar item.";
        setStatus({ kind: "error", message: msg });
        return;
      }

      setCart((prev) => {
        const idx = prev.findIndex((p) => p.productId === json.product.id);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return next;
        }
        return [
          ...prev,
          {
            productId: json.product.id,
            name: json.product.name,
            unitPrice: Number(json.product.price ?? 0),
            quantity: 1,
          },
        ];
      });

      setBarcode("");
      setStatus({ kind: "idle" });
    } catch {
      setStatus({ kind: "error", message: "Falha ao buscar item." });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function finalizeSale() {
    if (cart.length === 0) return;
    setBusy(true);
    setStatus({ kind: "idle" });

    try {
      const res = await fetch("/api/dashboard/caixa/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          paymentMethod,
          paymentNotes: paymentNotes.trim() || null,
        }),
      });

      const json = (await res.json()) as
        | { ok: true; orderNumber: number; total: number }
        | { error: string; detail?: string };

      if (!res.ok || !("ok" in json)) {
        setStatus({ kind: "error", message: "Não foi possível finalizar a venda." });
        return;
      }

      setCart([]);
      setBarcode("");
      setStatus({
        kind: "success",
        message: `Venda registrada. Pedido #${json.orderNumber} (${formatBrl(Number(json.total ?? 0))}) — ${
          paymentMethod === "cash"
            ? "Dinheiro"
            : paymentMethod === "pix"
              ? "Pix"
              : paymentMethod === "card"
                ? "Cartão"
                : "Outro"
        }.`,
      });
    } catch {
      setStatus({ kind: "error", message: "Não foi possível finalizar a venda." });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Leitor / Código de barras</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Escaneie ou digite o código e pressione Enter para adicionar.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Código
            </label>
            <input
              ref={inputRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (busy) return;
                void addByBarcode(barcode);
              }}
              placeholder="Ex: 7891234567890"
              inputMode="numeric"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <button
            type="button"
            onClick={() => void addByBarcode(barcode)}
            disabled={busy || !barcode.trim()}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Adicionar
          </button>
        </div>

        {status.kind !== "idle" && status.message ? (
          <div
            className={`mt-4 rounded-2xl border p-3 text-sm ${
              status.kind === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {status.message}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pagamento</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Selecione como o cliente pagou para registrar na venda.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Forma
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="cash">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="card">Cartão</option>
              <option value="other">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Observação
            </label>
            <input
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Opcional (ex: Pix Nubank, débito, 2x)"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Carrinho</h2>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Total: {formatBrl(total)}</div>
        </div>

        {cart.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Nenhum item ainda.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {cart.map((item) => (
              <li key={item.productId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {item.quantity} × {formatBrl(item.unitPrice)} = {formatBrl(item.unitPrice * item.quantity)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCart((prev) => {
                        const next = prev
                          .map((p) =>
                            p.productId === item.productId
                              ? { ...p, quantity: Math.max(1, p.quantity - 1) }
                              : p,
                          )
                          .filter(Boolean);
                        return next;
                      });
                    }}
                    className="h-9 w-9 rounded-lg border border-zinc-300 bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCart((prev) =>
                        prev.map((p) =>
                          p.productId === item.productId ? { ...p, quantity: p.quantity + 1 } : p,
                        ),
                      );
                    }}
                    className="h-9 w-9 rounded-lg border border-zinc-300 bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCart((prev) => prev.filter((p) => p.productId !== item.productId))}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void finalizeSale()}
            disabled={busy || cart.length === 0}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Finalizar venda
          </button>

          <button
            type="button"
            onClick={() => {
              setCart([]);
              setStatus({ kind: "idle" });
              setBarcode("");
              inputRef.current?.focus();
            }}
            disabled={busy || cart.length === 0}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Limpar
          </button>
        </div>
      </section>
    </div>
  );
}
