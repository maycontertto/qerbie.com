import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  createCarwashVehicleProfile,
  updateCarwashVehicleProfile,
} from "@/lib/carwash/actions";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(date);
}

function ticketStatusLabel(status: string): string {
  switch (status) {
    case "waiting": return "Aguardando";
    case "called": return "Chamado";
    case "serving": return "Em atendimento";
    case "completed": return "Concluído";
    case "cancelled": return "Cancelado";
    case "no_show": return "Não compareceu";
    default: return status;
  }
}

function appointmentStatusLabel(status: string): string {
  switch (status) {
    case "pending": return "Aguardando confirmação";
    case "confirmed": return "Confirmado";
    case "declined": return "Recusado";
    case "cancelled": return "Cancelado";
    default: return status;
  }
}

export default async function LavaJatoHistoricoModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canManage =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products") ||
        hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canManage) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Histórico do lava-jato</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Você não tem permissão para acessar este módulo.</p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient({}, { withAuth: true });
  const [profilesResult, servicesResult, ticketsResult, appointmentsResult] = await Promise.all([
    supabase
      .from("carwash_vehicle_profiles")
      .select("id, vehicle_label, owner_name, owner_contact, notes, updated_at")
      .eq("merchant_id", merchant.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("carwash_services")
      .select("id, name")
      .eq("merchant_id", merchant.id),
    supabase
      .from("queue_tickets")
      .select("id, ticket_number, status, vehicle_label, carwash_service_id, created_at")
      .eq("merchant_id", merchant.id)
      .not("carwash_service_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("merchant_appointment_requests")
      .select("id, vehicle_label, carwash_service_id, status, slot_starts_at, customer_contact")
      .eq("merchant_id", merchant.id)
      .not("carwash_service_id", "is", null)
      .order("slot_starts_at", { ascending: false })
      .limit(100),
  ]);

  const serviceNameById = new Map((servicesResult.data ?? []).map((service) => [service.id, service.name]));
  const activity = [
    ...(ticketsResult.data ?? []).map((ticket) => ({
      id: `ticket-${ticket.id}`,
      vehicle: ticket.vehicle_label || "Veículo sem identificação",
      service: ticket.carwash_service_id ? serviceNameById.get(ticket.carwash_service_id) ?? "Serviço" : "Serviço",
      status: ticketStatusLabel(ticket.status),
      date: ticket.created_at,
      detail: `Senha #${ticket.ticket_number}`,
    })),
    ...(appointmentsResult.data ?? []).map((appointment) => ({
      id: `appointment-${appointment.id}`,
      vehicle: appointment.vehicle_label || "Veículo sem identificação",
      service: appointment.carwash_service_id ? serviceNameById.get(appointment.carwash_service_id) ?? "Serviço" : "Serviço",
      status: appointmentStatusLabel(appointment.status),
      date: appointment.slot_starts_at,
      detail: appointment.customer_contact || "Agendamento",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 100);

  const banner =
    saved === "1"
      ? { kind: "success" as const, message: "Veículo salvo." }
      : error === "invalid"
        ? { kind: "error" as const, message: "Confira os dados informados." }
        : error === "save_failed"
          ? { kind: "error" as const, message: "Não foi possível salvar agora. Tente novamente." }
          : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Histórico do lava-jato</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Cadastre veículos e acompanhe os últimos serviços e agendamentos.
          </p>
        </div>

        {banner ? (
          <div className={`mt-6 rounded-2xl border p-4 text-sm ${
            banner.kind === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          }`}>
            {banner.message}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-6">
            <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Cadastrar veículo</h2>
              <form action={createCarwashVehicleProfile} className="mt-4 space-y-3">
                <input type="hidden" name="return_to" value="/dashboard/modulos/lava_historico" />
                <input name="vehicle_label" required minLength={2} maxLength={120} placeholder="Placa ou identificação do veículo" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                <input name="owner_name" maxLength={120} placeholder="Nome do cliente (opcional)" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                <input name="owner_contact" maxLength={120} placeholder="Contato (opcional)" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                <textarea name="notes" maxLength={2000} placeholder="Observações do veículo (opcional)" className="min-h-24 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                <button type="submit" className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
                  Cadastrar veículo
                </button>
              </form>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Veículos cadastrados</h2>
              {profilesResult.data?.length ? profilesResult.data.map((profile) => (
                <article key={profile.id} className="rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{profile.vehicle_label}</h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {profile.owner_name || "Cliente não informado"}{profile.owner_contact ? ` • ${profile.owner_contact}` : ""}
                  </p>
                  <form action={updateCarwashVehicleProfile} className="mt-3 grid gap-2">
                    <input type="hidden" name="return_to" value="/dashboard/modulos/lava_historico" />
                    <input type="hidden" name="id" value={profile.id} />
                    <input name="vehicle_label" required minLength={2} maxLength={120} defaultValue={profile.vehicle_label} aria-label="Identificação do veículo" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                    <input name="owner_name" maxLength={120} defaultValue={profile.owner_name ?? ""} placeholder="Nome do cliente" aria-label="Nome do cliente" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                    <input name="owner_contact" maxLength={120} defaultValue={profile.owner_contact ?? ""} placeholder="Contato" aria-label="Contato" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                    <textarea name="notes" maxLength={2000} defaultValue={profile.notes ?? ""} placeholder="Observações" aria-label="Observações" className="min-h-20 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                    <button type="submit" className="justify-self-end rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">Salvar</button>
                  </form>
                </article>
              )) : (
                <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                  Nenhum veículo cadastrado ainda.
                </div>
              )}
            </section>
          </aside>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Atividade recente</h2>
            {activity.length ? activity.map((item) => (
              <article key={item.id} className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.vehicle}</h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{item.service} • {item.detail}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatDateTime(item.date)}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {item.status}
                  </span>
                </div>
              </article>
            )) : (
              <div className="rounded-2xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                Ainda não há serviços ou agendamentos de lava-jato registrados.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
