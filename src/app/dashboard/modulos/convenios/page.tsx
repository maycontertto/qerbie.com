import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createClinicInsurancePlan, updateClinicInsurancePlan } from "@/lib/clinic/insuranceActions";

export const dynamic = "force-dynamic";

const fieldClass = "mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

export default async function ConveniosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user, merchant } = await getDashboardUserOrRedirect();
  const { error, saved } = await searchParams;
  if (merchant.business_category !== "clinica" && merchant.business_category !== "consultorio") redirect("/dashboard");
  const isOwner = user.id === merchant.owner_user_id;

  const supabase = isOwner ? await createClient({}, { withAuth: true }) : null;
  const { data: plans } = supabase
    ? await supabase
        .from("clinic_insurance_plans")
        .select("id, provider_name, plan_name, registration_code, contact, notes, is_active, updated_at")
        .eq("merchant_id", merchant.id)
        .order("provider_name", { ascending: true })
        .order("plan_name", { ascending: true })
    : { data: [] };

  const banner = error === "invalid"
    ? { kind: "error", message: "Informe a operadora e o nome do plano." }
    : error === "save_failed"
      ? { kind: "error", message: "Não foi possível salvar. Confira se a migração 067 foi aplicada e tente novamente." }
      : saved === "1"
        ? { kind: "success", message: "Convênio salvo." }
        : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/dashboard" className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-200">← Voltar ao painel</Link>
      <div className="mt-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Convênios</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Cadastre operadoras e planos aceitos pela clínica. Esses dados ficam visíveis somente para a conta proprietária.</p>
      </div>

      {banner ? <div role="status" className={`mt-5 rounded-xl border p-3 text-sm ${banner.kind === "error" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"}`}>{banner.message}</div> : null}

      {!isOwner ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          O cadastro de convênios está disponível apenas para a conta proprietária.
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Novo plano</h2>
            <form action={createClinicInsurancePlan} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Operadora<input name="provider_name" required minLength={2} maxLength={120} placeholder="Ex.: Unimed" className={fieldClass} /></label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome do plano<input name="plan_name" required minLength={2} maxLength={120} placeholder="Ex.: Empresarial Regional" className={fieldClass} /></label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Código / registro (opcional)<input name="registration_code" maxLength={80} placeholder="Código interno do convênio" className={fieldClass} /></label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Contato da operadora (opcional)<input name="contact" maxLength={160} placeholder="Telefone ou e-mail" className={fieldClass} /></label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">Observações e regras de atendimento<textarea name="notes" maxLength={2000} rows={3} placeholder="Anote informações administrativas para a equipe." className={fieldClass} /></label>
              <div className="sm:col-span-2 flex justify-end"><button type="submit" className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900">Cadastrar convênio</button></div>
            </form>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Planos cadastrados <span className="text-sm font-normal text-zinc-500">({plans?.length ?? 0})</span></h2>
            {!plans?.length ? <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">Nenhum convênio cadastrado ainda.</div> : plans.map((plan) => (
              <form key={plan.id} action={updateClinicInsurancePlan} className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2">
                <input type="hidden" name="id" value={plan.id} />
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Operadora<input name="provider_name" required minLength={2} maxLength={120} defaultValue={plan.provider_name} className={fieldClass} /></label>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Plano<input name="plan_name" required minLength={2} maxLength={120} defaultValue={plan.plan_name} className={fieldClass} /></label>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Código / registro<input name="registration_code" maxLength={80} defaultValue={plan.registration_code ?? ""} className={fieldClass} /></label>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Contato<input name="contact" maxLength={160} defaultValue={plan.contact ?? ""} className={fieldClass} /></label>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">Observações<textarea name="notes" maxLength={2000} rows={2} defaultValue={plan.notes ?? ""} className={fieldClass} /></label>
                <div className="flex items-center justify-between gap-4 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"><input type="checkbox" name="is_active" defaultChecked={plan.is_active} className="h-4 w-4 rounded" />Plano ativo</label>
                  <button type="submit" className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">Salvar alterações</button>
                </div>
              </form>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
