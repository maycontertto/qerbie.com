import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createCoupon, updateCoupon } from "@/lib/catalog/couponActions";

function localDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default async function CuponsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const canManage = user.id === merchant.owner_user_id || Boolean(membership && hasMemberPermission(membership.role, membership.permissions, "dashboard_sales"));
  if (!canManage) return <main className="mx-auto max-w-3xl p-8">Você não tem permissão para acessar cupons.</main>;

  const supabase = await createClient({}, { withAuth: true });
  const { data: coupons, error: loadError } = await supabase.from("coupons").select("id, code, description, discount_type, discount_value, minimum_subtotal, valid_from, valid_until, is_active").eq("merchant_id", merchant.id).order("created_at", { ascending: false });
  const tableMissing = Boolean(loadError && (loadError.code === "42P01" || loadError.code === "PGRST205"));
  const input = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800";
  const button = "rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900";
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <Link href="/dashboard" className="text-sm font-medium hover:underline">← Voltar ao painel</Link>
    <h1 className="mt-3 text-3xl font-bold">Cupons de desconto</h1>
    <p className="mt-1 text-sm text-zinc-500">Crie códigos promocionais para os pedidos do autoatendimento.</p>
    {params.saved === "1" && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Cupom salvo.</p>}
    {params.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{params.error === "duplicate" ? "Já existe um cupom com esse código." : params.error === "invalid" ? "Confira os dados do cupom." : "Não foi possível salvar. Tente novamente."}</p>}
    {tableMissing ? <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="font-semibold">Ative os cupons no banco de dados</h2>
      <p className="mt-2">Execute uma vez o script <code>integrations/supabase/schema/061_coupons.sql</code> no SQL Editor do Supabase. Depois, atualize esta página.</p>
    </section> : loadError ? <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar os cupons agora.</p> : <>
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Novo cupom</h2>
        <form action={createCoupon} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input name="code" required minLength={3} maxLength={32} placeholder="Código (ex.: BEMVINDO10)" className={input} />
          <input name="description" maxLength={240} placeholder="Descrição (opcional)" className={input} />
          <select name="discount_type" className={input}><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select>
          <input name="discount_value" required type="number" min="0.01" step="0.01" placeholder="Desconto" className={input} />
          <input name="minimum_subtotal" type="number" min="0" step="0.01" defaultValue="0" placeholder="Compra mínima (R$)" className={input} />
          <label className="text-xs text-zinc-500">Começa em<input name="valid_from" type="datetime-local" className={`${input} mt-1`} /></label>
          <label className="text-xs text-zinc-500">Termina em<input name="valid_until" type="datetime-local" className={`${input} mt-1`} /></label>
          <button className={`${button} self-end`} type="submit">Criar cupom</button>
        </form>
      </section>
      <section className="mt-6 space-y-3">
        {(coupons ?? []).length ? coupons!.map((coupon) => <form key={coupon.id} action={updateCoupon} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="coupon_id" value={coupon.id} />
          <input name="code" required defaultValue={coupon.code} className={input} aria-label="Código" />
          <input name="description" defaultValue={coupon.description ?? ""} placeholder="Descrição" className={input} aria-label="Descrição" />
          <select name="discount_type" defaultValue={coupon.discount_type} className={input}><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select>
          <input name="discount_value" required type="number" min="0.01" step="0.01" defaultValue={coupon.discount_value} className={input} aria-label="Desconto" />
          <input name="minimum_subtotal" type="number" min="0" step="0.01" defaultValue={coupon.minimum_subtotal} className={input} aria-label="Compra mínima" />
          <label className="text-xs text-zinc-500">Começa em<input name="valid_from" type="datetime-local" defaultValue={localDate(coupon.valid_from)} className={`${input} mt-1`} /></label>
          <label className="text-xs text-zinc-500">Termina em<input name="valid_until" type="datetime-local" defaultValue={localDate(coupon.valid_until)} className={`${input} mt-1`} /></label>
          <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"><input type="checkbox" name="is_active" defaultChecked={coupon.is_active} />Ativo</label>
          <button className={button} type="submit">Salvar alterações</button>
        </form>) : <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">Nenhum cupom cadastrado ainda.</div>}
      </section>
    </>}
  </main>;
}
