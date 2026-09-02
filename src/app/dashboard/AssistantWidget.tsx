"use client";

import { useRef, useState } from "react";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Presente quando a mensagem é uma proposta de ação de escrita aguardando confirmação. */
  pendingActionId?: string;
  pendingActionResolved?: boolean;
}

interface ConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
}

function formatConversationDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function AssistantWidget({ merchantName }: { merchantName: string }) {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [resolvingActionId, setResolvingActionId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);

  async function openHistory() {
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/ai/conversations");
      const data = await res.json();
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch {
      setConversations([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadConversation(id: string) {
    setShowHistory(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/conversations/${id}`);
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        conversationIdRef.current = id;
        setMessages(data.messages.map((m: { role: ChatRole; content: string }) => ({ role: m.role, content: m.content })));
      }
    } catch {
      // mantém a conversa atual se o carregamento falhar
    } finally {
      setLoading(false);
    }
  }

  function startNewConversation() {
    setShowHistory(false);
    conversationIdRef.current = undefined;
    setMessages([]);
  }

  /**
   * Confirma ou rejeita uma ação de escrita proposta pela IA. NUNCA reenvia
   * argumentos — o backend só reexecuta o que já está salvo em
   * ai_pending_actions (ver src/app/api/ai/actions/[id]/confirm/route.ts).
   */
  async function resolvePendingAction(msgIndex: number, decision: "confirm" | "reject") {
    const target = messages[msgIndex];
    if (!target?.pendingActionId || target.pendingActionResolved) return;
    const actionId = target.pendingActionId;

    setResolvingActionId(actionId);
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, pendingActionResolved: true } : m)));

    try {
      const res = await fetch(`/api/ai/actions/${actionId}/${decision}`, { method: "POST" });
      const data = await res.json();
      const resultText =
        decision === "reject"
          ? "Ação cancelada. Nada foi alterado."
          : data.ok
            ? "✅ Ação executada com sucesso."
            : `❌ Não foi possível executar: ${data.error ?? "erro desconhecido"}`;
      setMessages((prev) => [...prev, { role: "assistant", content: resultText }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Não consegui falar com o assistente agora. Tente novamente." },
      ]);
    } finally {
      setResolvingActionId(null);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationIdRef.current, message: text }),
      });
      const data = await res.json();

      if (data.conversationId) conversationIdRef.current = data.conversationId;

      if (data.pendingAction && typeof data.pendingAction.id === "string") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: String(data.pendingAction.previewText ?? "Confirma essa ação?"),
            pendingActionId: data.pendingAction.id,
            pendingActionResolved: false,
          },
        ]);
      } else {
        const reply =
          typeof data.reply === "string"
            ? data.reply
            : "O assistente ainda não está disponível. Fale com o suporte se precisar de ajuda agora.";
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Não consegui falar com o assistente agora. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir assistente de IA"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8-1.06 0-2.077-.163-3.02-.463L3 21l1.36-4.083C3.5 15.61 3 13.87 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[70vh] max-h-150 w-[90vw] max-w-sm flex-col rounded-2xl border border-zinc-200 bg-white/95 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Assistente Qerbie</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{merchantName}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={startNewConversation}
                title="Nova conversa"
                aria-label="Nova conversa"
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <button
                type="button"
                onClick={openHistory}
                title="Conversas anteriores"
                aria-label="Conversas anteriores"
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3M21 12a9 9 0 1 1-3.5-7.14M21 4v5h-5" />
                </svg>
              </button>
            </div>
          </div>

          {showHistory ? (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loadingHistory ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma conversa anterior ainda.</p>
              ) : (
                <ul className="space-y-1.5">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => loadConversation(c.id)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <p className="truncate text-zinc-800 dark:text-zinc-200">{c.title || "Conversa sem título"}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatConversationDate(c.updated_at)}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Pergunte sobre vendas, estoque ou agenda de hoje. Ex.: &ldquo;quanto vendi hoje?&rdquo;
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    {m.content}
                    {m.pendingActionId && !m.pendingActionResolved && (
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => resolvePendingAction(i, "confirm")}
                          disabled={resolvingActionId === m.pendingActionId}
                          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => resolvePendingAction(i, "reject")}
                          disabled={resolvingActionId === m.pendingActionId}
                          className="rounded-full bg-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-800 disabled:opacity-50 dark:bg-zinc-600 dark:text-zinc-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-zinc-100 px-3.5 py-2 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    Pensando...
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua pergunta..."
              disabled={loading}
              className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  );
}
