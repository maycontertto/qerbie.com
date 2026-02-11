"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Slot = {
  id: string;
  queue_id: string | null;
  starts_at: string;
  ends_at: string;
};

type Queue = { id: string; name: string };

type Service = {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number;
  notes?: string | null;
};

type QueueServiceRow = { queue_id: string; service_id: string };

type RequestStatus = "pending" | "confirmed" | "declined" | "cancelled";

type RequestState = {
  requestId: string;
  status: RequestStatus;
  slotStartsAt: string;
  slotEndsAt: string;
  queueId: string | null;
  serviceId: string | null;
};

type RefreshResult =
  | { ok: true; data: RequestState }
  | { ok: false; error: string };

function storageKey(qrToken: string): string {
  return `qerbie_beauty_agenda_request:${qrToken}`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function formatBrlCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents ?? 0) / 100);
}

export function CustomerBeautyAgendaBrowser({
  qrToken,
  slots,
  queues,
  services,
  queueServices,
  hasSession,
}: {
  qrToken: string;
  slots: Slot[];
  queues: Queue[];
  services: Service[];
  queueServices: QueueServiceRow[];
  hasSession: boolean;
}) {
  const [contact, setContact] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id ?? "");
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [request, setRequest] = useState<RequestState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queueNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const q of queues) m.set(q.id, q.name);
    return m;
  }, [queues]);

  const serviceNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services) m.set(s.id, s.name);
    return m;
  }, [services]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

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
    if (!selectedQueueId) return;
    const stillOk = eligibleQueues.some((q) => q.id === selectedQueueId);
    if (!stillOk) {
      setSelectedQueueId("");
    }
  }, [eligibleQueues, selectedQueueId]);

  const filteredSlots = useMemo(() => {
    if (eligibleQueueIds && eligibleQueueIds.size === 0) return [];

    return slots.filter((s) => {
      if (selectedQueueId) return s.queue_id === selectedQueueId;
      if (!eligibleQueueIds) return true;
      return s.queue_id ? eligibleQueueIds.has(s.queue_id) : false;
    });
  }, [eligibleQueueIds, selectedQueueId, slots]);

  const refreshRequest = useCallback(
    async (requestId: string): Promise<RefreshResult> => {
      const res = await fetch(
        `/api/s/${encodeURIComponent(qrToken)}/agenda/requests/${encodeURIComponent(requestId)}`,
        { cache: "no-store" },
      );

      const jsonUnknown: unknown = await res.json().catch(() => null);
      const json = asObject(jsonUnknown) ?? {};

      if (!res.ok) {
        return { ok: false, error: typeof json.error === "string" ? json.error : "unknown" };
      }

      const status = String(json.status ?? "pending") as RequestStatus;
      return {
        ok: true,
        data: {
          requestId: String(json.id ?? requestId),
          status,
          slotStartsAt: String(json.slotStartsAt ?? ""),
          slotEndsAt: String(json.slotEndsAt ?? ""),
          queueId: typeof json.queueId === "string" ? json.queueId : null,
          serviceId: typeof json.serviceId === "string" ? json.serviceId : null,
        },
      };
    },
    [qrToken],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(qrToken));
      if (!raw) return;
      const parsed = asObject(JSON.parse(raw)) ?? {};
      const requestId = typeof parsed.requestId === "string" ? parsed.requestId : "";
      if (!requestId) return;
      setRequest({
        requestId,
        status: "pending",
        slotStartsAt: "",
        slotEndsAt: "",
        queueId: null,
        serviceId: null,
      });
    } catch {
      // ignore
    }
  }, [qrToken]);

  useEffect(() => {
    if (!request) return;

    let cancelled = false;
    const run = async () => {
      const out = await refreshRequest(request.requestId);
      if (cancelled) return;
      if (out.ok) {
        setRequest(out.data);
        if (["confirmed", "declined", "cancelled"].includes(out.data.status)) {
          try {
            localStorage.removeItem(storageKey(qrToken));
          } catch {
            // ignore
          }
        }
      }
    };

    run();
    const id = window.setInterval(run, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [qrToken, refreshRequest, request]);

  async function requestSlot(slotId: string) {
    if (!hasSession) {
      window.location.href = `/s/${encodeURIComponent(qrToken)}`;
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const res = await fetch(`/api/s/${encodeURIComponent(qrToken)}/agenda/requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slotId,
          customerName: null,
          contact: contact.trim() || null,
          notes: notes.trim() || null,
          serviceId: selectedServiceId || null,
        }),
      });

      const jsonUnknown: unknown = await res.json().catch(() => null);
      const json = asObject(jsonUnknown) ?? {};

      if (!res.ok) {
        setError("Não foi possível solicitar este horário agora.");
        return;
      }

      const requestId = typeof json.requestId === "string" ? json.requestId : "";
      if (!requestId) {
        setError("Não foi possível solicitar este horário agora.");
        return;
      }

      try {
        localStorage.setItem(storageKey(qrToken), JSON.stringify({ requestId }));
      } catch {
        // ignore
      }

      setRequest({
        requestId,
        status: "pending",
        slotStartsAt: "",
        slotEndsAt: "",
        queueId: null,
        serviceId: null,
      });
    } catch {
      setError("Não foi possível solicitar este horário agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agendamento</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Escolha um serviço, um profissional (opcional) e um horário disponível.
        </p>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Serviço</label>
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
            {selectedService?.notes ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                {selectedService.notes}
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Profissional (opcional)</label>
            <select
              value={selectedQueueId}
              onChange={(e) => setSelectedQueueId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">Qualquer profissional</option>
              {eligibleQueues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
            {eligibleQueueIds && eligibleQueues.length === 0 ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Este serviço ainda não foi vinculado a nenhum profissional.
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Contato (opcional)</label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="WhatsApp, telefone ou e-mail"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Observações (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: preferência de horário, restrições"
              className="mt-1 min-h-16 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </div>

      {request ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Solicitação</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Status: {request.status === "pending" ? "Pendente" : request.status === "confirmed" ? "Confirmado" : request.status === "declined" ? "Recusado" : "Cancelado"}
          </p>
          {request.slotStartsAt ? (
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
              {formatDateTime(request.slotStartsAt)} → {formatDateTime(request.slotEndsAt)}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {request.serviceId ? `Serviço: ${serviceNameById.get(request.serviceId) ?? ""}` : null}
            {request.queueId ? ` • Profissional: ${queueNameById.get(request.queueId) ?? ""}` : null}
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Horários disponíveis</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Selecione um horário para solicitar.
        </p>

        <div className="mt-4 space-y-2">
          {!filteredSlots.length ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Nenhum horário disponível no momento.</p>
          ) : (
            filteredSlots.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy || Boolean(request)}
                onClick={() => requestSlot(s.id)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatDateTime(s.starts_at)}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {s.queue_id ? queueNameById.get(s.queue_id) ?? "" : ""}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Após solicitar, aguarde a confirmação do estabelecimento.
        </p>
      </div>
    </div>
  );
}
