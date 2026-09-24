"use client";

import { useEffect, useMemo, useState } from "react";

type Register = { id: string; name: string; is_active: boolean };
type Member = { id: string; display_name: string | null; login: string | null; job_title: string | null; cash_register_device_id: string | null };
type Report = { id: string; name: string; sales: number; count: number };
type RecentSale = { id: string; orderNumber: number; total: number; createdAt: string; registerName: string; cashierName: string; offlineSynced: boolean; items: Array<{ name: string; quantity: number; lineTotal: number }> };
type Payload = { registers: Register[]; members: Member[]; report: Report[]; cashierReport: Report[]; recentOrders: RecentSale[] };

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function CaixasClient() {
  const [payload, setPayload] = useState<Payload>({ registers: [], members: [], report: [], cashierReport: [], recentOrders: [] });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const total = useMemo(() => payload.report.reduce((sum, row) => sum + row.sales, 0), [payload.report]);

  async function refresh() {
    try {
      const response = await fetch("/api/dashboard/caixa/registers", { cache: "no-store" });
      const body = await response.json();
      if (response.ok && body.ok) setPayload(body as Payload);
    } catch {
      setMessage("Não foi possível atualizar os caixas agora.");
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function act(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/dashboard/caixa/registers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Falha ao salvar.");
      setMessage(success);
      if (body.action === "create") setName("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {message ? <p role="status" className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">{message}</p> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Computadores e caixas</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Cadastre um caixa para cada computador de venda e associe quem vai operar nele.</p>
          </div>
          <form className="flex w-full gap-2 sm:w-auto" onSubmit={(event) => { event.preventDefault(); void act({ action: "create", name }, "Caixa criado."); }}>
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} placeholder="Ex.: Caixa 2" className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 sm:w-56 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50" />
            <button disabled={busy} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900">Adicionar</button>
          </form>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {payload.registers.map((register) => (
            <div key={register.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{register.name}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{register.is_active ? "Ativo" : "Desativado"}</p>
                </div>
                <button disabled={busy} onClick={() => void act({ action: "toggle", registerId: register.id, active: !register.is_active }, register.is_active ? "Caixa desativado." : "Caixa ativado.")} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
                  {register.is_active ? "Desativar" : "Ativar"}
                </button>
              </div>
              <label className="mt-4 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Funcionário responsável</label>
              <select value={payload.members.find((member) => member.cash_register_device_id === register.id)?.id ?? ""} onChange={(event) => void act({ action: "assign", memberId: event.target.value || payload.members.find((member) => member.cash_register_device_id === register.id)?.id, registerId: event.target.value ? register.id : null }, "Responsável atualizado.")} disabled={busy || !register.is_active} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
                <option value="">Sem funcionário vinculado</option>
                {payload.members.filter((member) => !member.cash_register_device_id || member.cash_register_device_id === register.id).map((member) => <option key={member.id} value={member.id}>{member.display_name ?? member.login ?? "Funcionário"} {member.job_title && member.job_title !== "Caixa" ? `(${member.job_title})` : ""}</option>)}
              </select>
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">A associação libera acesso ao PDV e identifica as vendas desse operador.</p>
            </div>
          ))}
          {payload.registers.length === 0 ? <p className="text-sm text-zinc-500">Nenhum caixa cadastrado.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Vendas por funcionário</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Consolidado dos últimos 30 dias, separado pelo usuário que registrou a venda.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead className="text-xs text-zinc-500"><tr><th className="pb-2">Funcionário</th><th className="pb-2">Vendas</th><th className="pb-2 text-right">Total</th></tr></thead><tbody>
          {payload.cashierReport.map((row) => <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800"><td className="py-3 font-medium text-zinc-900 dark:text-zinc-50">{row.name}</td><td className="py-3 text-zinc-600 dark:text-zinc-300">{row.count}</td><td className="py-3 text-right text-zinc-900 dark:text-zinc-50">{money(row.sales)}</td></tr>)}
          {payload.cashierReport.length === 0 ? <tr><td colSpan={3} className="py-5 text-center text-zinc-500">Ainda não há vendas registradas nesse período.</td></tr> : null}
        </tbody></table></div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Movimentação por caixa</h2><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Vendas concluídas nos últimos 30 dias.</p></div>
          <div className="text-right"><div className="text-xs text-zinc-500 dark:text-zinc-400">Total consolidado</div><div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{money(total)}</div></div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-sm"><thead className="text-xs text-zinc-500"><tr><th className="pb-2">Caixa</th><th className="pb-2">Vendas</th><th className="pb-2 text-right">Total</th></tr></thead><tbody>
            {payload.report.map((row) => <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800"><td className="py-3 font-medium text-zinc-900 dark:text-zinc-50">{row.name}</td><td className="py-3 text-zinc-600 dark:text-zinc-300">{row.count}</td><td className="py-3 text-right text-zinc-900 dark:text-zinc-50">{money(row.sales)}</td></tr>)}
            {payload.report.length === 0 ? <tr><td colSpan={3} className="py-5 text-center text-zinc-500">Ainda não há vendas vinculadas a caixas nesse período.</td></tr> : null}
          </tbody></table>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Vendas recentes</h2>
        <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {payload.recentOrders.slice(0, 20).map((sale) => <details key={sale.id} className="border-b border-zinc-200 py-3 text-sm last:border-0 dark:border-zinc-800"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2"><div><p className="font-medium text-zinc-900 dark:text-zinc-50">Venda #{sale.orderNumber} · {sale.registerName} <span className="font-normal text-zinc-500">· {sale.cashierName}</span>{sale.offlineSynced ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Sincronizada offline</span> : null}</p><p className="text-xs text-zinc-500">{new Date(sale.createdAt).toLocaleString("pt-BR")}</p></div><span className="font-semibold text-zinc-900 dark:text-zinc-50">{money(sale.total)}</span></summary><ul className="mt-3 space-y-1 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950">{sale.items.map((item, index) => <li key={`${sale.id}-${index}`} className="flex justify-between gap-3"><span>{item.quantity} × {item.name}</span><span>{money(item.lineTotal)}</span></li>)}{sale.items.length === 0 ? <li className="text-zinc-500">Itens ainda não disponíveis neste histórico.</li> : null}</ul></details>)}
          {payload.recentOrders.length === 0 ? <p className="py-4 text-sm text-zinc-500">Nenhuma venda recente.</p> : null}
        </div>
      </section>
    </div>
  );
}
