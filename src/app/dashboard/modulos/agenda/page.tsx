import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  cancelAppointmentSlot,
  confirmAppointmentRequest,
  createAppointmentSlot,
  declineAppointmentRequest,
} from "@/lib/merchant/agendaActions";

type SlotStatus = "available" | "pending" | "booked" | "cancelled";
type RequestStatus = "pending" | "confirmed" | "declined" | "cancelled";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function slotBadge(status: SlotStatus): { label: string; cls: string } {
  switch (status) {
    case "available":
      return { label: "Disponível", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" };
    case "pending":
      return { label: "Pendente", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" };
    case "booked":
      return { label: "Confirmado", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" };
    case "cancelled":
      return { label: "Cancelado", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" };
  }
}

function requestBadge(status: RequestStatus): { label: string; cls: string } {
  switch (status) {
    case "pending":
      return { label: "Aguardando confirmação", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" };
    case "confirmed":
      return { label: "Confirmado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" };
    case "declined":
      return { label: "Recusado", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" };
    case "cancelled":
      return { label: "Cancelado", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" };
  }
}

export default async function AgendaModulePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const { error, saved } = await searchParams;

  const isOwner = user.id === merchant.owner_user_id;
  const canAgenda =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canAgenda) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Agenda
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const [
    { data: queues },
    { data: slots },
    { data: pendingRequests },
    { data: services },
    { data: aestheticServices },
    { data: beautyServices },
  ] = await Promise.all([
    supabase
      .from("merchant_queues")
      .select("id, name")
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("merchant_appointment_slots")
      .select("id, queue_id, starts_at, ends_at, status, is_active")
      .eq("merchant_id", merchant.id)
      .order("starts_at", { ascending: true })
      .limit(200),
    supabase
      .from("merchant_appointment_requests")
      .select(
        "id, queue_id, service_id, aesthetic_service_id, beauty_service_id, customer_name, customer_contact, customer_notes, status, slot_starts_at, slot_ends_at, created_at",
      )
      .eq("merchant_id", merchant.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("barbershop_services")
      .select("id, name")
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    supabase
      .from("aesthetic_services")
      .select("id, name")
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    supabase
      .from("beauty_services")
      .select("id, name")
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
  ]);

  const queueNameById = new Map<string, string>();
  for (const q of queues ?? []) queueNameById.set(q.id, q.name);

  const serviceNameById = new Map<string, string>();
  for (const s of services ?? []) serviceNameById.set(s.id, s.name);

  const aestheticServiceNameById = new Map<string, string>();
  for (const s of aestheticServices ?? []) aestheticServiceNameById.set(s.id, s.name);

  const beautyServiceNameById = new Map<string, string>();
  for (const s of beautyServices ?? []) beautyServiceNameById.set(s.id, s.name);

  const banner =
    error === "invalid_slot"
      ? { kind: "error" as const, message: "Horário inválido." }
      : error === "slot_create_failed"
        ? { kind: "error" as const, message: "Não foi possível criar o horário." }
        : error === "invalid_request"
          ? { kind: "error" as const, message: "Solicitação inválida." }
          : error === "save_failed"
            ? { kind: "error" as const, message: "Não foi possível salvar. Tente novamente." }
            : saved
              ? { kind: "success" as const, message: "Salvo." }
              : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
              >
                ← Voltar ao painel
              </Link>
              <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Agenda
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Publique horários e confirme solicitações de agendamento.
              </p>
            </div>
          </div>

          {banner && (
            <div
              className={`mt-6 rounded-lg border p-3 text-sm ${
                banner.kind === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              {banner.message}
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-12">
            <section className="lg:col-span-4">
              <div className="rounded-2xl border border-zinc-200 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Publicar horário
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  A clínica define horários disponíveis. O cliente solicita e você confirma.
                </p>

                <form action={createAppointmentSlot} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Profissional/especialidade
                    </label>
                    <select
                      name="queue_id"
                      defaultValue=""
                      className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      <option value="">(Sem vínculo)</option>
                      {(queues ?? []).map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Dica: crie filas na Recepção para cada profissional.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Início
                    </label>
                    <input
                      name="starts_at"
                      type="datetime-local"
                      required
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Duração (min)
                    </label>
                    <input
                      name="duration_min"
                      type="number"
                      min={5}
                      max={24 * 60}
                      defaultValue={30}
                      required
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Publicar
                  </button>
                </form>
              </div>
            </section>

            <section className="lg:col-span-8">
              <div className="rounded-2xl border border-zinc-200 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Solicitações pendentes
                </h2>

                {(pendingRequests ?? []).length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhuma solicitação pendente.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {(pendingRequests ?? []).map((r) => {
                      const badge = requestBadge(r.status as RequestStatus);
                      const queueName = r.queue_id ? (queueNameById.get(r.queue_id) ?? "") : "";
                      const serviceId = (r as { service_id?: string | null }).service_id ?? null;
                      const aestheticServiceId = (r as { aesthetic_service_id?: string | null }).aesthetic_service_id ?? null;
                      const beautyServiceId = (r as { beauty_service_id?: string | null }).beauty_service_id ?? null;
                      const serviceName = aestheticServiceId
                        ? aestheticServiceNameById.get(String(aestheticServiceId)) ?? ""
                        : beautyServiceId
                          ? beautyServiceNameById.get(String(beautyServiceId)) ?? ""
                        : serviceId
                          ? serviceNameById.get(String(serviceId)) ?? ""
                          : "";
                      return (
                        <div
                          key={r.id}
                          className="rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                {formatDateTime(r.slot_starts_at)} – {formatDateTime(r.slot_ends_at)}
                              </div>
                              {queueName ? (
                                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                  {queueName}
                                </div>
                              ) : null}
                              {serviceName ? (
                                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                  {serviceName}
                                </div>
                              ) : null}

                              <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                                <span className="font-semibold">Cliente:</span> {r.customer_name || "(sem nome)"}
                              </div>
                              {r.customer_contact ? (
                                <div className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-200">
                                  <span className="font-semibold">Contato:</span> {r.customer_contact}
                                </div>
                              ) : null}
                              {r.customer_notes ? (
                                <div className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-200">
                                  <span className="font-semibold">Obs:</span> {r.customer_notes}
                                </div>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <form action={confirmAppointmentRequest}>
                              <input type="hidden" name="request_id" value={r.id} />
                              <button
                                type="submit"
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                              >
                                Confirmar
                              </button>
                            </form>

                            <form action={declineAppointmentRequest}>
                              <input type="hidden" name="request_id" value={r.id} />
                              <button
                                type="submit"
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                              >
                                Recusar
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Horários publicados
                </h2>

                {(slots ?? []).length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Nenhum horário publicado.</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {(slots ?? []).map((s) => {
                      const badge = slotBadge(s.status as SlotStatus);
                      const queueName = s.queue_id ? (queueNameById.get(s.queue_id) ?? "") : "";
                      return (
                        <div
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                        >
                          <div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                              {formatDateTime(s.starts_at)} – {formatDateTime(s.ends_at)}
                            </div>
                            {queueName ? (
                              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                {queueName}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge.cls}`}>
                              {badge.label}
                            </span>

                            {s.is_active && s.status !== "cancelled" ? (
                              <form action={cancelAppointmentSlot}>
                                <input type="hidden" name="slot_id" value={s.id} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                                >
                                  Cancelar
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
