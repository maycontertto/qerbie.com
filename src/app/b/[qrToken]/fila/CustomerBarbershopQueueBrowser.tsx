"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Queue = { id: string; name: string; avg_service_min: number | null };

type Service = { id: string; name: string; duration_min: number; price_cents: number };

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
  return `qerbie_barbershop_queue_ticket:${qrToken}:${queueId}`;
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

export function CustomerBarbershopQueueBrowser({
  qrToken,
  queues,
  services,
  hasSession,
}: {
  qrToken: string;
  queues: Queue[];
  services: Service[];
  hasSession: boolean;
}) {
  const [selectedQueueId, setSelectedQueueId] = useState<string>(queues[0]?.id ?? "");
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id ?? "");
  const [customerName, setCustomerName] = useState<string>("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketState | null>(null);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
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
        `/api/b/${encodeURIComponent(qrToken)}/queues/${encodeURIComponent(queueId)}/tickets/${encodeURIComponent(ticketId)}`,
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
      window.location.href = `/b/${encodeURIComponent(qrToken)}`;
      return;
    }
    if (!selectedQueueId) return;

    setJoinError(null);
    setJoining(true);

    try {
      const res = await fetch(
        `/api/b/${encodeURIComponent(qrToken)}/queues/${encodeURIComponent(selectedQueueId)}/tickets`,
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
        localStorage.setItem(
          storageKey(qrToken, selectedQueueId),
          JSON.stringify({ ticketId, ticketNumber }),
        );
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
                : "";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Fila online</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Escolha o serviço e o barbeiro (se quiser) e acompanhe sua posição.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Serviço
            </label>
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
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Barbeiro/Fila</label>
            <select
              value={selectedQueueId}
              onChange={(e) => setSelectedQueueId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              {queues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Seu nome (opcional)
            </label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              placeholder="Ex.: João"
            />
          </div>
        </div>

        {joinError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {joinError}
          </div>
        ) : null}

        <button
          type="button"
          disabled={joining || !selectedQueueId || !selectedServiceId}
          onClick={joinQueue}
          className="mt-4 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {joining ? "Entrando..." : "Entrar na fila"}
        </button>

        {ticket ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">Sua senha: {ticket.ticketNumber}</div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Status: {statusText}
                  {ticket.position ? ` • Posição: ${ticket.position}` : ""}
                  {typeof ticket.etaMinutes === "number" ? ` • Estimativa: ${formatEta(ticket.etaMinutes)}` : ""}
                </div>
                {selectedService ? (
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Serviço: {selectedService.name}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Dica</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Se você fechar esta tela, seu ticket fica salvo neste celular.
        </p>
      </div>
    </div>
  );
}
