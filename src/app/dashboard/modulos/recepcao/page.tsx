import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  callNextTicket,
  createMerchantQueue,
  setTicketStatus,
  updateMerchantQueue,
} from "@/lib/merchant/queueActions";

type QueueStatus = "open" | "paused" | "closed";

type TicketStatus =
  | "waiting"
  | "called"
  | "serving"
  | "completed"
  | "cancelled"
  | "no_show";

function formatStatus(status: QueueStatus): string {
  if (status === "open") return "Aberta";
  if (status === "paused") return "Pausada";
  return "Fechada";
}

function ticketBadge(status: TicketStatus): { label: string; cls: string } {
  switch (status) {
    case "waiting":
      return { label: "Aguardando", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" };
    case "called":
      return { label: "Chamado", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" };
    case "serving":
      return { label: "Em atendimento", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" };
    case "completed":
      return { label: "Concluído", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" };
    case "cancelled":
      return { label: "Cancelado", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" };
    case "no_show":
      return { label: "Não compareceu", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" };
  }
}

export default async function RecepcaoModulePage({
  searchParams,
}: {
  searchParams: Promise<{ queue?: string; error?: string; saved?: string }>;
}) {
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const { queue, error, saved } = await searchParams;

  const isOwner = user.id === merchant.owner_user_id;
  const canReception =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canReception) {
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
              Recepção
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

  const { data: queues } = await supabase
    .from("merchant_queues")
    .select("id, name, status, is_active, avg_service_min")
    .eq("merchant_id", merchant.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: services } = await supabase
    .from("barbershop_services")
    .select("id, name")
    .eq("merchant_id", merchant.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const { data: aestheticServices } = await supabase
    .from("aesthetic_services")
    .select("id, name")
    .eq("merchant_id", merchant.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const serviceNameById = new Map<string, string>();
  for (const s of services ?? []) serviceNameById.set(s.id, s.name);

  const aestheticServiceNameById = new Map<string, string>();
  for (const s of aestheticServices ?? []) aestheticServiceNameById.set(s.id, s.name);

  const selectedQueueId = (queue ?? "").trim() || queues?.[0]?.id || "";

  const selectedQueue = (queues ?? []).find((q) => q.id === selectedQueueId) ?? null;

  const { data: tickets } = selectedQueueId
    ? await supabase
        .from("queue_tickets")
        .select("id, ticket_number, status, customer_name, created_at, service_id, aesthetic_service_id")
        .eq("merchant_id", merchant.id)
        .eq("queue_id", selectedQueueId)
        .in("status", ["waiting", "called", "serving"])
        .order("ticket_number", { ascending: true })
    : {
        data: [] as Array<{
          id: string;
          ticket_number: number;
          status: TicketStatus;
          customer_name: string | null;
          created_at: string;
          service_id: string | null;
          aesthetic_service_id: string | null;
        }>,
      };

  const banner =
    error === "invalid_queue"
      ? { kind: "error" as const, message: "Fila inválida." }
      : error === "queue_create_failed"
        ? { kind: "error" as const, message: "Não foi possível criar a fila." }
        : error === "invalid_ticket"
          ? { kind: "error" as const, message: "Ticket inválido." }
          : error === "no_waiting"
            ? { kind: "error" as const, message: "Não há ninguém aguardando nessa fila." }
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
                Recepção
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Fila online por profissional/especialidade (cliente acompanha pelo QR).
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
                  Filas
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Crie uma fila para cada profissional/especialidade.
                </p>

                <form action={createMerchantQueue} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Nome
                    </label>
                    <input
                      name="name"
                      type="text"
                      minLength={2}
                      required
                      placeholder="Ex.: Dra. Ana — Odontologia"
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Tempo médio (min) (opcional)
                    </label>
                    <input
                      name="avg_service_min"
                      type="number"
                      min={0}
                      max={1000}
                      placeholder="Ex.: 15"
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Criar fila
                  </button>
                </form>

                <div className="mt-5 space-y-2">
                  {(queues ?? []).length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Nenhuma fila criada.
                    </p>
                  ) : (
                    (queues ?? []).map((q) => (
                      <Link
                        key={q.id}
                        href={`/dashboard/modulos/recepcao?queue=${encodeURIComponent(q.id)}`}
                        className={`block rounded-lg border px-3 py-2 text-sm ${
                          q.id === selectedQueueId
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                            : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <div className="font-semibold">{q.name}</div>
                        <div className="mt-0.5 text-xs opacity-80">
                          {formatStatus(q.status as QueueStatus)}
                          {!q.is_active ? " • inativa" : ""}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="lg:col-span-8">
              <div className="rounded-2xl border border-zinc-200 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {selectedQueue ? selectedQueue.name : "Selecione uma fila"}
                </h2>

                {selectedQueue ? (
                  <>
                    <form action={updateMerchantQueue} className="mt-4 grid gap-3 sm:grid-cols-3">
                      <input type="hidden" name="queue_id" value={selectedQueue.id} />

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Status
                        </label>
                        <select
                          name="status"
                          defaultValue={selectedQueue.status as QueueStatus}
                          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                        >
                          <option value="open">Aberta</option>
                          <option value="paused">Pausada</option>
                          <option value="closed">Fechada</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Tempo médio (min)
                        </label>
                        <input
                          name="avg_service_min"
                          type="number"
                          min={0}
                          max={1000}
                          defaultValue={selectedQueue.avg_service_min ?? ""}
                          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </div>

                      <div className="flex items-end gap-3">
                        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                          <input
                            name="is_active"
                            type="checkbox"
                            defaultChecked={selectedQueue.is_active}
                            className="h-4 w-4"
                          />
                          Ativa
                        </label>
                      </div>

                      <div className="sm:col-span-3 flex flex-wrap gap-3">
                        <button
                          type="submit"
                          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                          Salvar
                        </button>
                      </div>
                    </form>

                    <form action={callNextTicket} className="mt-3">
                      <input type="hidden" name="queue_id" value={selectedQueue.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Chamar próximo
                      </button>
                    </form>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                    Crie ou selecione uma fila.
                  </p>
                )}
              </div>

              {selectedQueue ? (
                <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Tickets ativos
                  </h3>

                  {(tickets ?? []).length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                      Ninguém na fila agora.
                    </p>
                  ) : (
                    <div className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                      {(tickets ?? []).map((t) => {
                        const badge = ticketBadge(t.status as TicketStatus);
                        const procedureName = t.aesthetic_service_id
                          ? aestheticServiceNameById.get(t.aesthetic_service_id) ?? ""
                          : t.service_id
                            ? serviceNameById.get(t.service_id) ?? ""
                            : "";
                        return (
                          <div
                            key={t.id}
                            className="flex flex-wrap items-center justify-between gap-3 bg-white/70 p-4 backdrop-blur dark:bg-zinc-900/50"
                          >
                            <div>
                              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                #{t.ticket_number}{" "}
                                {t.customer_name ? (
                                  <span className="font-normal text-zinc-500 dark:text-zinc-400">
                                    • {t.customer_name}
                                  </span>
                                ) : null}
                              </div>
                              {procedureName ? (
                                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                  {procedureName}
                                </div>
                              ) : null}
                              <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <form action={setTicketStatus}>
                                <input type="hidden" name="queue_id" value={selectedQueue.id} />
                                <input type="hidden" name="ticket_id" value={t.id} />
                                <input type="hidden" name="status" value="serving" />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                                >
                                  Em atendimento
                                </button>
                              </form>

                              <form action={setTicketStatus}>
                                <input type="hidden" name="queue_id" value={selectedQueue.id} />
                                <input type="hidden" name="ticket_id" value={t.id} />
                                <input type="hidden" name="status" value="completed" />
                                <button
                                  type="submit"
                                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                                >
                                  Concluir
                                </button>
                              </form>

                              <form action={setTicketStatus}>
                                <input type="hidden" name="queue_id" value={selectedQueue.id} />
                                <input type="hidden" name="ticket_id" value={t.id} />
                                <input type="hidden" name="status" value="no_show" />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                                >
                                  Não compareceu
                                </button>
                              </form>

                              <form action={setTicketStatus}>
                                <input type="hidden" name="queue_id" value={selectedQueue.id} />
                                <input type="hidden" name="ticket_id" value={t.id} />
                                <input type="hidden" name="status" value="cancelled" />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950"
                                >
                                  Cancelar
                                </button>
                              </form>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                    Dica: o cliente vê a posição em tempo real pelo QR (módulo cliente).
                  </p>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
