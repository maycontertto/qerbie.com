"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Queue = { id: string; name: string; avg_service_min: number | null };

type Service = {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number;
  important_notes?: string | null;
};

type QueueServiceRow = { queue_id: string; service_id: string };

type TicketStatus =
  | "waiting"
  | "called"
  | "serving"
  | "completed"
  | "cancelled"
  | "no_show";

type TicketState = {
  ticketId: string;
  ticketNumber: number;
  status: TicketStatus;
  position: number;
  etaMinutes: number | null;
};

type RefreshTicketResult =
  | {
      ok: true;
      data: {
        ticketNumber: number;
        status: TicketStatus;
        position: number;
        etaMinutes: number | null;
      };
    }
  | { ok: false; error: string };

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function storageKey(qrToken: string, queueId: string): string {
  return `qerbie_aesthetic_queue_ticket:${qrToken}:${queueId}`;
}

function formatEta(mins: number): string {
  if (mins <= 0) return "agora";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function formatBrlCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents ?? 0) / 100);
}

export function CustomerAestheticQueueBrowser({
  qrToken,
  queues,
  services,
  queueServices,
  hasSession,
}: {
  qrToken: string;
  queues: Queue[];
  services: Service[];
  queueServices: QueueServiceRow[];
  hasSession: boolean;
}) {
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id ?? "");
  const [selectedQueueId, setSelectedQueueId] = useState<string>(queues[0]?.id ?? "");
  const [customerName, setCustomerName] = useState<string>("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketState | null>(null);

  const serviceById = useMemo(() => {
    const m = new Map<string, Service>();
    for (const s of services) m.set(s.id, s);
    return m;
  }, [services]);

  const queueById = useMemo(() => {
    const m = new Map<string, Queue>();
    for (const q of queues) m.set(q.id, q);
    return m;
  }, [queues]);

  const mappingByServiceId = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of queueServices) {
      const set = m.get(r.service_id) ?? new Set<string>();
      set.add(r.queue_id);
      m.set(r.service_id, set);
    }
    return m;
  }, [queueServices]);

  const eligibleQueueIds = useMemo(() => {
    const set = mappingByServiceId.get(selectedServiceId);
    if (!set || set.size === 0) return null;
    return set;
  }, [mappingByServiceId, selectedServiceId]);

  const eligibleQueues = useMemo(() => {
    if (!eligibleQueueIds) return queues;
    return queues.filter((q) => eligibleQueueIds.has(q.id));
  }, [eligibleQueueIds, queues]);

  useEffect(() => {
    if (!selectedServiceId) return;

    const stillOk = eligibleQueues.some((q) => q.id === selectedQueueId);
    if (!stillOk) {
      setSelectedQueueId(eligibleQueues[0]?.id ?? "");
    }
  }, [eligibleQueues, selectedQueueId, selectedServiceId]);

  const selectedService = useMemo(
    () => serviceById.get(selectedServiceId) ?? null,
    [selectedServiceId, serviceById],
  );

  useEffect(() => {
    const cookie = document.cookie || "";
    const m = cookie.match(/(?:^|; )qerbie_customer_name=([^;]+)/);
    if (m) {
      try {
        setCustomerName(decodeURIComponent(m[1] ?? ""));
      } catch {
        setCustomerName(m[1] ?? "");
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedQueueId) return;
    setJoinError(null);
    setTicket(null);

    try {
      const raw = localStorage.getItem(storageKey(qrToken, selectedQueueId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ticketId?: unknown; ticketNumber?: unknown };
      const ticketId = typeof parsed.ticketId === "string" ? parsed.ticketId : "";
      const ticketNumber = Number(parsed.ticketNumber ?? 0);
      if (!ticketId || !Number.isFinite(ticketNumber) || ticketNumber <= 0) return;

      setTicket({
        ticketId,
        ticketNumber,
        status: "waiting",
        position: 0,
        etaMinutes: null,
      });
    } catch {
      // ignore
    }
  }, [qrToken, selectedQueueId]);

  const refreshTicket = useCallback(
    async (queueId: string, ticketId: string): Promise<RefreshTicketResult> => {
      const res = await fetch(
        `/api/e/${encodeURIComponent(qrToken)}/queues/${encodeURIComponent(queueId)}/tickets/${encodeURIComponent(ticketId)}`,
        { cache: "no-store" },
      );

      const jsonUnknown: unknown = await res.json().catch(() => null);
      const json = asObject(jsonUnknown) ?? {};

      if (!res.ok) {
        const error = typeof json.error === "string" ? json.error : "unknown";
        return { ok: false, error };
      }

      const etaRaw = json.etaMinutes;
      const etaMinutes = etaRaw === null || etaRaw === undefined ? null : Number(etaRaw);

      return {
        ok: true,
        data: {
          ticketNumber: Number(json.ticketNumber ?? 0),
          status: String(json.status ?? "waiting") as TicketStatus,
          position: Number(json.position ?? 0),
          etaMinutes: Number.isFinite(etaMinutes) ? etaMinutes : null,
        },
      };
    },
    [qrToken],
  );

  useEffect(() => {
    if (!ticket || !selectedQueueId) return;

    let cancelled = false;
    const run = async () => {
      const out = await refreshTicket(selectedQueueId, ticket.ticketId);
      if (cancelled) return;
      if (out.ok) {
        const data = out.data;
        setTicket((prev) =>
          prev
            ? {
                ...prev,
                ticketNumber: data.ticketNumber,
                status: data.status,
                position: data.position,
                etaMinutes: data.etaMinutes,
              }
            : prev,
        );

        if (["completed", "cancelled", "no_show"].includes(data.status)) {
          try {
            localStorage.removeItem(storageKey(qrToken, selectedQueueId));
          } catch {
            // ignore
          }
        }
      }
    };

    run();
    const id = window.setInterval(run, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [qrToken, refreshTicket, selectedQueueId, ticket]);

  async function joinQueue() {
    if (!hasSession) {
      window.location.href = `/e/${encodeURIComponent(qrToken)}`;
      return;
    }

    if (!selectedQueueId) return;
    if (!selectedServiceId) return;

    setJoinError(null);
    setJoining(true);

    try {
      const res = await fetch(
        `/api/e/${encodeURIComponent(qrToken)}/queues/${encodeURIComponent(selectedQueueId)}/tickets`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerName: customerName.trim() || null,
            serviceId: selectedServiceId || null,
          }),
        },
      );

      const jsonUnknown: unknown = await res.json().catch(() => null);
      const json = asObject(jsonUnknown) ?? {};
      if (!res.ok) {
        setJoinError("Não foi possível entrar na fila agora. Tente novamente.");
        return;
      }

      const ticketId = typeof json.ticketId === "string" ? json.ticketId : "";
      const ticketNumber = Number(json.ticketNumber ?? 0);
      if (!ticketId || !Number.isFinite(ticketNumber) || ticketNumber <= 0) {
        setJoinError("Não foi possível entrar na fila agora. Tente novamente.");
        return;
      }

      try {
        localStorage.setItem(storageKey(qrToken, selectedQueueId), JSON.stringify({ ticketId, ticketNumber }));
      } catch {
        // ignore
      }

      setTicket({
        ticketId,
        ticketNumber,
        status: "waiting",
        position: 0,
        etaMinutes: null,
      });
    } catch {
      setJoinError("Não foi possível entrar na fila agora. Tente novamente.");
    } finally {
      setJoining(false);
    }
  }

  const statusText =
    ticket?.status === "waiting"
      ? "Aguardando"
      : ticket?.status === "called"
        ? "Chamado"
        : ticket?.status === "serving"
          ? "Em atendimento"
          : ticket?.status === "completed"
            ? "Concluído"
            : ticket?.status === "no_show"
              ? "Não compareceu"
              : ticket?.status === "cancelled"
                ? "Cancelado"
                : null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recepção</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Selecione o procedimento e confirme sua presença para entrar na fila.
        </p>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Procedimento</label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} • {formatBrlCents(s.price_cents)} • {s.duration_min}min
                </option>
              ))}
            </select>
            {selectedService?.important_notes ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                {selectedService.important_notes}
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Profissional</label>
            <select
              value={selectedQueueId}
              onChange={(e) => setSelectedQueueId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              {eligibleQueues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
            {eligibleQueueIds && eligibleQueues.length === 0 ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Este procedimento ainda não foi vinculado a nenhum profissional.
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Nome (opcional)</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Seu nome"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
        </div>

        {joinError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {joinError}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {selectedService ? `Selecionado: ${selectedService.name}` : null}
            {selectedQueueId ? ` • ${queueById.get(selectedQueueId)?.name ?? ""}` : null}
          </div>

          <button
            type="button"
            disabled={joining || !selectedQueueId || !selectedServiceId || (eligibleQueueIds ? eligibleQueues.length === 0 : false)}
            onClick={joinQueue}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {joining ? "Entrando..." : "Confirmar presença"}
          </button>
        </div>
      </div>

      {ticket ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Sua senha</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">{ticket.ticketNumber}</div>
              {statusText ? <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{statusText}</div> : null}
            </div>
            {ticket.status === "waiting" ? (
              <div className="text-right">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">#{ticket.position}</div>
                {typeof ticket.etaMinutes === "number" ? (
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    ~ {formatEta(ticket.etaMinutes)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
