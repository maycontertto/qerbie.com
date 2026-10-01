import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createClinicPatientRecord } from "@/lib/clinic/patientRecordActions";

export const dynamic = "force-dynamic";

const fieldClass = "mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

export default async function ProntuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user, merchant } = await getDashboardUserOrRedirect();
  const { error, saved } = await searchParams;
  if (merchant.business_category !== "clinica" && merchant.business_category !== "consultorio") redirect("/dashboard");
  const isOwner = user.id === merchant.owner_user_id;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const supabase = isOwner ? await createClient({}, { withAuth: true }) : null;
  const { data: records } = supabase
    ? await supabase
        .from("clinic_patient_records")
        .select("id, patient_name, patient_contact, visit_date, reason, record_notes, created_at")
        .eq("merchant_id", merchant.id)
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  const banner = error === "invalid"
    ? { kind: "error", message: "Informe o nome do paciente, a data e as anotações do atendimento." }
    : error === "save_failed"
      ? { kind: "error", message: "Não foi possível salvar. Confira se a migração 068 foi aplicada." }
      : saved === "1"
        ? { kind: "success", message: "Registro salvo com acesso restrito à conta proprietária." }
        : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/dashboard" className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-200">← Voltar ao painel</Link>
      <header className="mt-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Prontuário</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Anotações internas dos atendimentos, separadas por estabelecimento e visíveis somente à conta proprietária.</p>
      </header>

      {banner ? <div role="status" className={`mt-5 rounded-xl border p-3 text-sm ${banner.kind === "error" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"}`}>{banner.message}</div> : null}

      {!isOwner ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">O prontuário está disponível apenas para a conta proprietária.</section>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Novo registro de atendimento</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Registre somente informações necessárias ao atendimento. Não use esta tela para urgências médicas.</p>
            <form action={createClinicPatientRecord} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Paciente<input name="patient_name" required minLength={2} maxLength={160} autoComplete="off" className={fieldClass} /></label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Contato (opcional)<input name="patient_contact" maxLength={160} autoComplete="off" className={fieldClass} /></label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Data do atendimento<input name="visit_date" required type="date" defaultValue={today} className={fieldClass} /></label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Motivo / referência<input name="reason" maxLength={1000} className={fieldClass} /></label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">Anotações<textarea name="record_notes" required maxLength={12000} rows={5} className={fieldClass} /></label>
              <div className="sm:col-span-2 flex justify-end"><button type="submit" className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900">Salvar registro</button></div>
            </form>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Registros recentes <span className="text-sm font-normal text-zinc-500">({records?.length ?? 0})</span></h2>
            {!records?.length ? <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">Nenhum registro cadastrado.</div> : records.map((record) => (
              <article key={record.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{record.patient_name}</h3>
                  <time dateTime={record.visit_date} className="text-sm text-zinc-500 dark:text-zinc-400">{new Date(`${record.visit_date}T12:00:00`).toLocaleDateString("pt-BR")}</time>
                </div>
                {record.patient_contact ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{record.patient_contact}</p> : null}
                {record.reason ? <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">{record.reason}</p> : null}
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{record.record_notes}</p>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
