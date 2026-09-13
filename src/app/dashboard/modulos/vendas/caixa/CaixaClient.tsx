"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ExternalLink,
  LockKeyhole,
  MessageCircle,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
  UnlockKeyhole,
  X,
} from "lucide-react";

type CartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  unitLabel: string;
};

type SearchResult = {
  id: string;
  name: string;
  price: number;
  barcode: string | null;
  unitLabel: string;
};

type LoadedOrder =
  | {
      ok: true;
      merchantName: string;
      order: {
        id: string;
        orderNumber: number;
        createdAt: string;
        status: string;
        subtotal: number;
        discount: number;
        total: number;
        paymentMethod: string | null;
        paymentNotes: string | null;
        cancellationReason: string | null;
        items: Array<{
          productId: string | null;
          name: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
          unitLabel: string;
        }>;
      };
    }
  | { error: string; detail?: string };

type CashSession = {
  id: string;
  openedAt: string;
  openingAmount: number;
  openingNotes: string | null;
  cashSales: number;
  withdrawals: number;
  deposits: number;
  expectedAmount: number;
  orderCount: number;
  movements: Array<{
    id: string;
    type: "withdrawal" | "deposit";
    amount: number;
    reason: string;
    createdAt: string;
    receiptUrl: string | null;
  }>;
};

type CashAction = "open" | "withdrawal" | "deposit" | "close";

type ScannerControls = {
  stop: () => void;
  switchTorch?: (onOff: boolean) => Promise<void>;
};

function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  const s = qty.toFixed(3);
  return s.replace(/\.?(0+)$/, "").replace(/\.$/, "");
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function CaixaClient({
  merchantName,
  operatorName,
}: {
  merchantName: string;
  operatorName: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const busyRef = useRef(false);
  const scannerOnRef = useRef(false);
  const scannerTorchOnRef = useRef(false);
  const scannerControlsRef = useRef<ScannerControls | null>(null);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);
  const addByBarcodeRef = useRef<(raw: string) => void>(() => {});

  const [itemQuery, setItemQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "pix" | "card" | "other">("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [loadedOrder, setLoadedOrder] = useState<Extract<LoadedOrder, { ok: true }> | null>(null);
  const [scannerOn, setScannerOn] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerTorchOn, setScannerTorchOn] = useState(false);
  const [scannerTorchSupported, setScannerTorchSupported] = useState(false);
  const [scannerLastRead, setScannerLastRead] = useState<string>("");
  const [status, setStatus] = useState<{ kind: "idle" | "error" | "success"; message?: string }>({
    kind: "idle",
  });
  const [busy, setBusy] = useState(false);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashLoading, setCashLoading] = useState(true);
  const [cashUnavailable, setCashUnavailable] = useState(false);
  const [cashAction, setCashAction] = useState<CashAction | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [cashReceipt, setCashReceipt] = useState<File | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  async function refreshCashSession() {
    setCashLoading(true);
    try {
      const response = await fetch("/api/dashboard/caixa/session", { cache: "no-store" });
      const payload = (await response.json()) as { ok?: boolean; session?: CashSession | null };
      if (!response.ok || !payload.ok) {
        setCashUnavailable(true);
        return;
      }
      setCashSession(payload.session ?? null);
      setCashUnavailable(false);
    } catch {
      setCashUnavailable(true);
    } finally {
      setCashLoading(false);
    }
  }

  useEffect(() => {
    void refreshCashSession();
  }, []);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    scannerOnRef.current = scannerOn;
  }, [scannerOn]);

  useEffect(() => {
    scannerTorchOnRef.current = scannerTorchOn;
  }, [scannerTorchOn]);

  useEffect(() => {
    if (!scannerOn) {
      const controls = scannerControlsRef.current;
      if (controls?.switchTorch && scannerTorchOnRef.current) {
        void controls.switchTorch(false);
      }
      controls?.stop();
      scannerControlsRef.current = null;
      setScannerError(null);
      setScannerTorchOn(false);
      setScannerTorchSupported(false);
      setScannerLastRead("");
      return;
    }

    let cancelled = false;

    async function start() {
      setScannerError(null);

      try {
        const video = videoRef.current;
        if (!video) return;

        const hasGetUserMedia =
          typeof navigator !== "undefined" &&
          !!navigator.mediaDevices &&
          typeof navigator.mediaDevices.getUserMedia === "function";

        const isSecure = typeof window !== "undefined" ? window.isSecureContext : false;

        if (!hasGetUserMedia) {
          setScannerTorchSupported(false);
          setScannerError(
            "Este navegador não disponibiliza câmera aqui (getUserMedia indisponível). Abra no Chrome/Safari fora de apps (Instagram/WhatsApp) e em HTTPS."
          );
          return;
        }

        if (!isSecure) {
          setScannerTorchSupported(false);
          setScannerError("A câmera só funciona em HTTPS (ou localhost). Abra a página usando HTTPS.");
          return;
        }

        const browser = await import("@zxing/browser");
        const lib = await import("@zxing/library");

        const hints = new Map();
        hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [
          lib.BarcodeFormat.EAN_13,
          lib.BarcodeFormat.EAN_8,
          lib.BarcodeFormat.CODE_128,
        ]);
        hints.set(lib.DecodeHintType.TRY_HARDER, true);

        const codeReader = new browser.BrowserMultiFormatOneDReader(hints, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 800,
          tryPlayVideoTimeout: 5000,
        });

        const onResult = (result: unknown) => {
          if (!result) return;
          if (cancelled) return;

          const r = result as { getText?: () => string; text?: string };
          const text = String(r.getText?.() ?? r.text ?? "").trim();
          if (!text) return;

          setScannerLastRead(text);

          const now = Date.now();
          const last = lastScanRef.current;
          if (last && last.text === text && now - last.at < 2000) return;
          lastScanRef.current = { text, at: now };

          if (busyRef.current) return;
          addByBarcodeRef.current(text);
        };

        // Keep constraints very simple for maximum compatibility across mobile browsers/WebViews.
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: "environment",
          },
        };

        // Some environments throw TypeError inside the ZXing getUserMedia path.
        // Obtaining the stream ourselves is more reliable and keeps the error messages actionable.
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          for (const track of stream.getTracks()) {
            try {
              track.stop();
            } catch {
              // ignore
            }
          }
          return;
        }

        const hasDecodeFromStream =
          typeof (codeReader as unknown as { decodeFromStream?: unknown }).decodeFromStream === "function";

        const controls = (hasDecodeFromStream
          ? ((await (codeReader as unknown as {
              decodeFromStream: (
                stream: MediaStream,
                video: HTMLVideoElement,
                callbackFn: (result?: unknown, error?: unknown) => void,
              ) => Promise<unknown>;
            }).decodeFromStream(stream, video, (result) => onResult(result))) as unknown as ScannerControls)
          : ((await codeReader.decodeFromVideoDevice(undefined, video, (result) => onResult(result))) as unknown as ScannerControls));

        if (cancelled) {
          controls.stop();
          return;
        }

        scannerControlsRef.current = controls;
        setScannerTorchSupported(Boolean(controls.switchTorch));

        if (scannerTorchOnRef.current && controls.switchTorch) {
          try {
            await controls.switchTorch(true);
          } catch {
            // ignore
          }
        }
      } catch (err) {
        let detail = "";
        if (err && typeof err === "object" && "name" in err && typeof (err as { name?: unknown }).name === "string") {
          detail = String((err as { name: string }).name);
        }

        let message = "";
        if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
          message = String((err as { message: string }).message);
        }

        const diag = (() => {
          try {
            const protocol = typeof window !== "undefined" ? window.location.protocol : "";
            const secure = typeof window !== "undefined" ? String(window.isSecureContext) : "";
            const mediaDevices = typeof navigator !== "undefined" ? String(Boolean(navigator.mediaDevices)) : "";
            const gum =
              typeof navigator !== "undefined" && navigator.mediaDevices
                ? String(typeof navigator.mediaDevices.getUserMedia === "function")
                : "";
            return `Diagnóstico: protocol=${protocol} secure=${secure} mediaDevices=${mediaDevices} getUserMedia=${gum}`;
          } catch {
            return "";
          }
        })();

        const msgBase = "Não foi possível iniciar a câmera.";
        const msgHint =
          "Verifique permissão do navegador e use HTTPS. Se estiver dentro do WhatsApp/Instagram, abra no Chrome/Safari.";
        const detailBlock = [detail, message].filter(Boolean).join(" — ");

        const lowered = `${detailBlock}`.toLowerCase();
        const looksLikeMissingMediaDevicesText =
          lowered.includes("getusermedia") && lowered.includes("undefined") && lowered.includes("cannot read");
        const actuallyMissingMediaDevices =
          typeof navigator === "undefined" ||
          !navigator.mediaDevices ||
          typeof navigator.mediaDevices.getUserMedia !== "function";
        const looksLikeMissingMediaDevices = looksLikeMissingMediaDevicesText && actuallyMissingMediaDevices;

        const msg = looksLikeMissingMediaDevices
          ? [
              "Este navegador não disponibiliza câmera aqui (mediaDevices/getUserMedia indisponível).",
              "Abra no Chrome/Safari (fora do WhatsApp/Instagram) e em HTTPS.",
              diag,
            ]
              .filter(Boolean)
              .join(" ")
          : detailBlock
            ? `${msgBase} (${detailBlock}) ${msgHint}${diag ? ` ${diag}` : ""}`
            : `${msgBase} ${msgHint}${diag ? ` ${diag}` : ""}`;

        scannerControlsRef.current?.stop();
        scannerControlsRef.current = null;
        setScannerTorchSupported(false);
        setScannerError(msg);
      }
    }

    void start();

    return () => {
      cancelled = true;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [scannerOn]);

  useEffect(() => {
    if (!scannerOn) return;
    const controls = scannerControlsRef.current;
    if (!controls?.switchTorch) return;
    void controls.switchTorch(scannerTorchOn).catch(() => {
      // ignore
    });
  }, [scannerOn, scannerTorchOn]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const total = useMemo(() => {
    return cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  }, [cart]);

  function isLikelyBarcode(q: string): boolean {
    return /^\d{4,}$/.test(q.trim());
  }

  function addProductToCart(product: { id: string; name: string; price: number; unitLabel: string }) {
    setCart((prev) => {
      const idx = prev.findIndex((p) => p.productId === product.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: Number(product.price ?? 0),
          quantity: 1,
          unitLabel: String(product.unitLabel ?? "un"),
        },
      ];
    });
  }

  async function searchProducts(raw: string) {
    const q = raw.trim();
    if (!q) return;

    setBusy(true);
    setStatus({ kind: "idle" });
    setLoadedOrder(null);

    try {
      const res = await fetch(`/api/dashboard/caixa/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as
        | { ok: true; results: SearchResult[] }
        | { error: string; detail?: string };

      if (!res.ok || !("ok" in json)) {
        setStatus({ kind: "error", message: "Falha ao buscar itens." });
        return;
      }

      const results = Array.isArray(json.results) ? json.results : [];
      setSearchResults(results);
      if (results.length === 0) {
        setStatus({ kind: "error", message: "Nenhum item encontrado." });
      }
    } catch {
      setStatus({ kind: "error", message: "Falha ao buscar itens." });
    } finally {
      setBusy(false);
      if (!scannerOnRef.current) {
        inputRef.current?.focus();
      }
    }
  }

  function sanitizePhone(raw: string): string {
    const digits = String(raw ?? "").replace(/\D/g, "");
    if (!digits || digits.length < 10) return "";
    if (digits.startsWith("55")) return digits;
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  }

  function paymentLabel(m: string | null): string {
    const s = String(m ?? "").trim().toLowerCase();
    if (s === "cash") return "Dinheiro";
    if (s === "pix") return "Pix";
    if (s === "card") return "Cartão";
    if (s === "other") return "Outro";
    return "Não informado";
  }

  function buildReceiptText(payload: Extract<LoadedOrder, { ok: true }>): string {
    const merchantName = payload.merchantName?.trim();
    const order = payload.order;

    const createdAt = (() => {
      const raw = String(order.createdAt ?? "").trim();
      if (!raw) return "";
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    })();

    const headerParts: string[] = ["CUPOM NÃO FISCAL"];
    if (merchantName) headerParts.push(merchantName);
    headerParts.push(`Pedido #${order.orderNumber}`);
    if (createdAt) headerParts.push(`Data: ${createdAt}`);

    const itemsLines = (order.items ?? []).map((i) => {
      const qty = formatQty(Number(i.quantity ?? 0));
      const unit = String(i.unitLabel ?? "un");
      const name = String(i.name ?? "").trim();
      const lineTotal = formatBrl(Number(i.lineTotal ?? Number(i.unitPrice ?? 0) * Number(i.quantity ?? 0)));
      return `- ${qty} ${unit} ${name} — ${lineTotal}`;
    });

    const paymentLine = order.paymentNotes
      ? `Pagamento: ${paymentLabel(order.paymentMethod)} (${order.paymentNotes})`
      : `Pagamento: ${paymentLabel(order.paymentMethod)}`;

    const subtotal = Number(order.subtotal ?? 0);
    const discount = Number(order.discount ?? 0);
    const total = Number(order.total ?? 0);

    const totalsLines = [
      subtotal ? `Subtotal: ${formatBrl(subtotal)}` : null,
      discount ? `Desconto: -${formatBrl(discount)}` : null,
      `Total: ${formatBrl(total)}`,
    ].filter(Boolean) as string[];

    const disclaimer = "Este cupom não é documento fiscal.";

    return [...headerParts, "", "Itens:", ...itemsLines, "", ...totalsLines, paymentLine, "", disclaimer].join(
      "\n",
    );
  }

  async function loadOrder(rawOrderNumber: string) {
    const o = rawOrderNumber.trim();
    if (!o) return;

    setBusy(true);
    setStatus({ kind: "idle" });

    try {
      const res = await fetch(`/api/dashboard/caixa/order?orderNumber=${encodeURIComponent(o)}`);
      const json = (await res.json()) as LoadedOrder;

      if (!res.ok || !("ok" in json)) {
        const msg =
          "error" in json && json.error === "not_found" ? "Pedido não encontrado." : "Falha ao buscar pedido.";
        setLoadedOrder(null);
        setStatus({ kind: "error", message: msg });
        return;
      }

      setLoadedOrder(json);
      setStatus({ kind: "success", message: `Pedido #${json.order.orderNumber} carregado.` });
    } catch {
      setLoadedOrder(null);
      setStatus({ kind: "error", message: "Falha ao buscar pedido." });
    } finally {
      setBusy(false);
    }
  }

  function openWhatsAppWithReceipt() {
    if (!loadedOrder) return;
    const to = sanitizePhone(customerPhone);
    if (!to) {
      setStatus({ kind: "error", message: "Informe o telefone do cliente (com DDD)." });
      return;
    }

    const text = buildReceiptText(loadedOrder);
    const url = `https://wa.me/${encodeURIComponent(to)}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setStatus({ kind: "success", message: "WhatsApp aberto com o cupom." });
  }

  async function addByBarcode(raw: string) {
    const code = raw.trim();
    if (!code) return;

    setBusy(true);
    setStatus({ kind: "idle" });

    try {
      const res = await fetch(`/api/dashboard/caixa/lookup?barcode=${encodeURIComponent(code)}`);
      const json = (await res.json()) as
        | { ok: true; product: { id: string; name: string; price: number; unitLabel: string } }
        | { error: string; detail?: string };

      if (!res.ok || !("ok" in json)) {
        const msg = "error" in json && json.error === "not_found" ? "Item não encontrado." : "Falha ao buscar item.";
        setStatus({ kind: "error", message: msg });
        return;
      }

      addProductToCart({
        id: json.product.id,
        name: json.product.name,
        price: Number(json.product.price ?? 0),
        unitLabel: String(json.product.unitLabel ?? "un"),
      });

      setItemQuery("");
      setSearchResults([]);
      setStatus({ kind: "idle" });
    } catch {
      setStatus({ kind: "error", message: "Falha ao buscar item." });
    } finally {
      setBusy(false);
      if (!scannerOnRef.current) {
        inputRef.current?.focus();
      }
    }
  }

  useEffect(() => {
    addByBarcodeRef.current = (raw: string) => {
      void addByBarcode(raw);
    };
  });

  async function finalizeSale() {
    if (cart.length === 0) return;
    setBusy(true);
    setStatus({ kind: "idle" });

    try {
      const res = await fetch("/api/dashboard/caixa/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          paymentMethod,
          paymentNotes: paymentNotes.trim() || null,
        }),
      });

      const json = (await res.json()) as
        | { ok: true; orderNumber: number; total: number }
        | { error: string; detail?: string };

      if (!res.ok || !("ok" in json)) {
        const message =
          "error" in json && json.error === "cash_register_closed"
            ? "Abra o caixa antes de receber uma venda em dinheiro."
            : "Não foi possível finalizar a venda.";
        setStatus({ kind: "error", message });
        return;
      }

      setCart([]);
      setItemQuery("");
      setSearchResults([]);
      setOrderNumber(String(json.orderNumber ?? ""));
      setLoadedOrder(null);
      setStatus({
        kind: "success",
        message: `Venda registrada. Pedido #${json.orderNumber} (${formatBrl(Number(json.total ?? 0))}) — ${
          paymentMethod === "cash"
            ? "Dinheiro"
            : paymentMethod === "pix"
              ? "Pix"
              : paymentMethod === "card"
                ? "Cartão"
                : "Outro"
        }.`,
      });
      void refreshCashSession();
    } catch {
      setStatus({ kind: "error", message: "Não foi possível finalizar a venda." });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function submitCashAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cashAction) return;
    setBusy(true);
    setStatus({ kind: "idle" });

    const formData = new FormData();
    formData.set("action", cashAction);
    formData.set("amount", cashAmount);
    formData.set("notes", cashReason);
    formData.set("reason", cashReason);
    if (cashReceipt) formData.set("receipt", cashReceipt);

    try {
      const response = await fetch("/api/dashboard/caixa/session", { method: "POST", body: formData });
      const payload = (await response.json()) as { ok?: boolean; error?: string; session?: CashSession | null };
      if (!response.ok || !payload.ok) {
        const messages: Record<string, string> = {
          receipt_required: "Anexe o comprovante da sangria.",
          invalid_movement: "Informe um valor e um motivo válido.",
          cash_register_closed: "O caixa já está fechado.",
          open_failed: "Já existe um caixa aberto ou não foi possível abrir.",
        };
        setStatus({ kind: "error", message: messages[payload.error ?? ""] ?? "Operação não concluída." });
        return;
      }
      setCashSession(payload.session ?? null);
      setCashAction(null);
      setCashAmount("");
      setCashReason("");
      setCashReceipt(null);
      setStatus({
        kind: "success",
        message:
          cashAction === "open"
            ? "Caixa aberto com sucesso."
            : cashAction === "close"
              ? "Caixa fechado e conferência registrada."
              : cashAction === "withdrawal"
                ? "Sangria registrada com comprovante."
                : "Entrada de dinheiro registrada.",
      });
    } catch {
      setStatus({ kind: "error", message: "Não foi possível concluir a operação do caixa." });
    } finally {
      setBusy(false);
    }
  }

  async function cancelLoadedOrder() {
    if (!loadedOrder || cancelReason.trim().length < 3) return;
    setBusy(true);
    try {
      const response = await fetch("/api/dashboard/caixa/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: loadedOrder.order.id, reason: cancelReason }),
      });
      if (!response.ok) {
        setStatus({ kind: "error", message: "Não foi possível cancelar este pedido." });
        return;
      }
      setCancelOpen(false);
      setCancelReason("");
      await loadOrder(String(loadedOrder.order.orderNumber));
      await refreshCashSession();
      setStatus({ kind: "success", message: `Pedido #${loadedOrder.order.orderNumber} cancelado e auditado.` });
    } finally {
      setBusy(false);
    }
  }

  const runSearch = () => {
    const query = itemQuery.trim();
    if (!query) return;
    if (isLikelyBarcode(query)) void addByBarcode(query);
    else void searchProducts(query);
  };

  return (
    <div className="space-y-4 pb-10">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-white shadow-lg">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-400 text-zinc-950">
                <CircleDollarSign size={22} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{merchantName}</p>
                <p className="truncate text-xs text-zinc-400">Operador: {operatorName}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Status" value={cashLoading ? "Verificando" : cashSession ? "Caixa aberto" : "Caixa fechado"} tone={cashSession ? "success" : "neutral"} />
            <Metric label="Saldo esperado" value={cashSession ? formatBrl(cashSession.expectedAmount) : "—"} />
            <Metric label="Vendas no turno" value={cashSession ? String(cashSession.orderCount) : "0"} />
            <Metric label="Em dinheiro" value={cashSession ? formatBrl(cashSession.cashSales) : formatBrl(0)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-zinc-800 bg-zinc-900/80 px-5 py-3">
          {!cashSession ? (
            <ActionButton icon={UnlockKeyhole} label="Abrir caixa" onClick={() => setCashAction("open")} primary />
          ) : (
            <>
              <ActionButton icon={ArrowDownToLine} label="Sangria" onClick={() => setCashAction("withdrawal")} />
              <ActionButton icon={ArrowUpFromLine} label="Reforço" onClick={() => setCashAction("deposit")} />
              <ActionButton icon={LockKeyhole} label="Fechar caixa" onClick={() => setCashAction("close")} danger />
            </>
          )}
          <span className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
            <Clock3 size={14} aria-hidden />
            {cashSession ? `Aberto às ${new Date(cashSession.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Nenhum turno em andamento"}
          </span>
        </div>
      </section>

      {cashUnavailable ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          O controle de caixa ainda não foi configurado no banco de dados. Aplique a migração 053 para habilitar abertura, sangria e fechamento.
        </div>
      ) : null}

      {status.kind !== "idle" && status.message ? (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${status.kind === "error" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"}`}>
          {status.kind === "success" ? <CheckCircle2 size={17} aria-hidden /> : <X size={17} aria-hidden />}
          {status.message}
        </div>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Search size={18} className="text-emerald-600" aria-hidden />
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Localizar produto</h2>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  ref={inputRef}
                  value={itemQuery}
                  onChange={(event) => setItemQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); runSearch(); }
                  }}
                  placeholder="Digite o produto ou leia o código de barras"
                  className="h-12 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
                <button type="button" onClick={runSearch} disabled={busy || !itemQuery.trim()} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  <Search size={17} aria-hidden /> Buscar
                </button>
                <button type="button" onClick={() => setScannerOn((value) => !value)} disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                  <ScanLine size={17} aria-hidden /> {scannerOn ? "Parar câmera" : "Usar câmera"}
                </button>
              </div>
            </div>

            {searchResults.length ? (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {searchResults.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{product.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{product.barcode || "Sem código"} · {product.unitLabel}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <strong className="text-sm text-zinc-900 dark:text-zinc-50">{formatBrl(product.price)}</strong>
                      <button type="button" onClick={() => { addProductToCart({ id: product.id, name: product.name, price: product.price, unitLabel: product.unitLabel }); setSearchResults([]); setItemQuery(""); }} className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-900 text-white hover:bg-emerald-600 dark:bg-zinc-50 dark:text-zinc-900" title="Adicionar ao carrinho">
                        <Plus size={17} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid min-h-48 place-items-center px-5 py-10 text-center">
                <div>
                  <ScanLine size={34} className="mx-auto text-zinc-300 dark:text-zinc-700" aria-hidden />
                  <p className="mt-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">Pronto para a próxima leitura</p>
                  <p className="mt-1 text-xs text-zinc-400">Use o leitor, a câmera ou pesquise pelo nome.</p>
                </div>
              </div>
            )}

            {scannerOn ? (
              <div className="border-t border-zinc-200 p-5 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Leitor por câmera</span>
                  <div className="flex gap-2">
                    {scannerTorchSupported ? <button type="button" onClick={() => setScannerTorchOn((value) => !value)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700">Lanterna {scannerTorchOn ? "ligada" : "desligada"}</button> : null}
                    <button type="button" onClick={() => setScannerOn(false)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700">Parar</button>
                  </div>
                </div>
                {scannerError ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{scannerError}</p> : null}
                <video ref={videoRef} className="mt-3 max-h-80 w-full rounded-lg bg-black object-cover" muted playsInline autoPlay />
                <p className="mt-2 text-xs text-zinc-500">Último código: {scannerLastRead || "—"}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <ReceiptText size={18} className="text-sky-600" aria-hidden />
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Consultar ou corrigir venda</h2>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-[180px_1fr_auto]">
              <input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadOrder(orderNumber); }} placeholder="Nº do pedido" inputMode="numeric" className="h-11 rounded-lg border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-950" />
              <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Telefone para enviar o cupom" inputMode="tel" className="h-11 rounded-lg border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-950" />
              <button type="button" onClick={() => void loadOrder(orderNumber)} disabled={busy || !orderNumber.trim()} className="h-11 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900">Consultar</button>
            </div>

            {loadedOrder ? (
              <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50">Pedido #{loadedOrder.order.orderNumber}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${loadedOrder.order.status === "cancelled" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"}`}>{loadedOrder.order.status === "cancelled" ? "Cancelado" : "Concluído"}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">{loadedOrder.order.items.length} item(ns) · {paymentLabel(loadedOrder.order.paymentMethod)}</p>
                    {loadedOrder.order.cancellationReason ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">Motivo: {loadedOrder.order.cancellationReason}</p> : null}
                  </div>
                  <strong className="text-lg text-zinc-900 dark:text-zinc-50">{formatBrl(loadedOrder.order.total)}</strong>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={openWhatsAppWithReceipt} className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold dark:border-zinc-700"><MessageCircle size={16} aria-hidden /> Enviar cupom</button>
                  {loadedOrder.order.status !== "cancelled" ? <button type="button" onClick={() => setCancelOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300"><X size={16} aria-hidden /> Cancelar pedido</button> : null}
                </div>
              </div>
            ) : null}
          </section>

          {cashSession?.movements.length ? (
            <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800"><h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Movimentações do turno</h2></div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {cashSession.movements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${movement.type === "withdrawal" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"}`}>{movement.type === "withdrawal" ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}</span>
                      <div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{movement.reason}</p><p className="text-xs text-zinc-500">{new Date(movement.createdAt).toLocaleString("pt-BR")}</p></div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {movement.receiptUrl ? <a href={movement.receiptUrl} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-zinc-700" title="Abrir comprovante"><ExternalLink size={16} /></a> : null}
                      <strong className={movement.type === "withdrawal" ? "text-red-700 dark:text-red-300" : "text-sky-700 dark:text-sky-300"}>{movement.type === "withdrawal" ? "−" : "+"}{formatBrl(movement.amount)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="rounded-lg border border-zinc-200 bg-white shadow-sm xl:sticky xl:top-24 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 p-5 dark:border-zinc-800">
            <div className="flex items-center gap-2"><ShoppingCart size={18} className="text-emerald-600" /><h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Venda atual</h2></div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{cart.length} itens</span>
          </div>

          <div className="max-h-[42vh] min-h-48 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="grid min-h-48 place-items-center p-6 text-center"><div><ShoppingCart size={30} className="mx-auto text-zinc-300" /><p className="mt-2 text-sm text-zinc-500">O carrinho está vazio.</p></div></div>
            ) : cart.map((item) => (
              <div key={item.productId} className="border-b border-zinc-100 p-4 last:border-b-0 dark:border-zinc-800">
                <div className="flex justify-between gap-3"><div><p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.name}</p><p className="mt-1 text-xs text-zinc-500">{formatBrl(item.unitPrice)} / {item.unitLabel}</p></div><strong className="text-sm text-zinc-900 dark:text-zinc-50">{formatBrl(item.unitPrice * item.quantity)}</strong></div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setCart((previous) => previous.map((product) => product.productId === item.productId ? { ...product, quantity: Math.max(0.001, Math.round((product.quantity - 1) * 1000) / 1000) } : product))} className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-300 dark:border-zinc-700" title="Diminuir"><Minus size={14} /></button>
                    <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => { const quantity = Math.max(0.001, Number(event.target.value) || 1); setCart((previous) => previous.map((product) => product.productId === item.productId ? { ...product, quantity } : product)); }} className="h-8 w-16 rounded-lg border border-zinc-300 bg-white text-center text-sm dark:border-zinc-700 dark:bg-zinc-950" aria-label={`Quantidade de ${item.name}`} />
                    <button type="button" onClick={() => setCart((previous) => previous.map((product) => product.productId === item.productId ? { ...product, quantity: product.quantity + 1 } : product))} className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-300 dark:border-zinc-700" title="Aumentar"><Plus size={14} /></button>
                  </div>
                  <button type="button" onClick={() => setCart((previous) => previous.filter((product) => product.productId !== item.productId))} className="grid h-8 w-8 place-items-center text-red-500 hover:text-red-700" title="Remover item"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-zinc-200 p-5 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase text-zinc-500">Pagamento</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {([
                ["cash", "Dinheiro", Banknote], ["pix", "Pix", QrCode], ["card", "Cartão", CreditCard], ["other", "Outro", CircleDollarSign],
              ] as const).map(([value, label, Icon]) => (
                <button key={value} type="button" onClick={() => setPaymentMethod(value)} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-1 text-xs font-semibold transition ${paymentMethod === value ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600 dark:bg-emerald-950 dark:text-emerald-200" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}><Icon size={18} /><span>{label}</span></button>
              ))}
            </div>
            <input value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Observação do pagamento (opcional)" className="mt-3 h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950" />

            <div className="mt-5 flex items-end justify-between border-t border-dashed border-zinc-300 pt-4 dark:border-zinc-700">
              <span className="text-sm text-zinc-500">Total a receber</span>
              <strong className="text-2xl text-zinc-950 dark:text-white">{formatBrl(total)}</strong>
            </div>
            <button type="button" onClick={() => void finalizeSale()} disabled={busy || cart.length === 0 || (paymentMethod === "cash" && !cashSession && !cashUnavailable)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"><CheckCircle2 size={19} /> Finalizar venda</button>
            {paymentMethod === "cash" && !cashSession && !cashUnavailable ? <p className="mt-2 text-center text-xs font-medium text-amber-700 dark:text-amber-300">Abra o caixa para receber em dinheiro.</p> : null}
            <button type="button" onClick={() => { setCart([]); setStatus({ kind: "idle" }); inputRef.current?.focus(); }} disabled={!cart.length || busy} className="mt-2 h-10 w-full text-sm font-semibold text-zinc-500 hover:text-red-600 disabled:opacity-40">Cancelar venda atual</button>
          </div>
        </aside>
      </div>

      {cashAction ? (
        <div className="fixed inset-0 z-100 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <form onSubmit={submitCashAction} className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{cashAction === "open" ? "Abrir caixa" : cashAction === "withdrawal" ? "Registrar sangria" : cashAction === "deposit" ? "Adicionar reforço" : "Fechar caixa"}</h2><p className="mt-1 text-sm text-zinc-500">{cashAction === "close" ? `Saldo esperado: ${formatBrl(cashSession?.expectedAmount ?? 0)}` : cashAction === "withdrawal" ? "Registre o destino do dinheiro e anexe o comprovante." : "Informe o valor para manter o saldo conferido."}</p></div><button type="button" onClick={() => setCashAction(null)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Fechar"><X size={18} /></button></div>
            <label className="mt-5 block text-sm font-medium text-zinc-700 dark:text-zinc-200">{cashAction === "close" ? "Valor contado no caixa" : cashAction === "open" ? "Troco inicial" : "Valor"}</label>
            <input autoFocus required type="number" min="0" step="0.01" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} placeholder="0,00" className="mt-2 h-12 w-full rounded-lg border border-zinc-300 px-3 text-lg font-semibold dark:border-zinc-700 dark:bg-zinc-950" />
            <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-200">{cashAction === "withdrawal" || cashAction === "deposit" ? "Motivo" : "Observação"}</label>
            <textarea required={cashAction === "withdrawal" || cashAction === "deposit"} value={cashReason} onChange={(event) => setCashReason(event.target.value)} placeholder={cashAction === "withdrawal" ? "Ex: compra de lâmpada para o estoque" : "Opcional"} className="mt-2 min-h-20 w-full resize-none rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            {cashAction === "withdrawal" ? <div className="mt-4"><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">Comprovante obrigatório</label><input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setCashReceipt(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:font-semibold dark:file:bg-zinc-800" /></div> : null}
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setCashAction(null)} className="h-10 rounded-lg border border-zinc-300 px-4 text-sm font-semibold dark:border-zinc-700">Voltar</button><button type="submit" disabled={busy || !cashAmount} className={`h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 ${cashAction === "close" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>Confirmar</button></div>
          </form>
        </div>
      ) : null}

      {cancelOpen && loadedOrder ? (
        <div className="fixed inset-0 z-100 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Cancelar pedido #{loadedOrder.order.orderNumber}</h2>
            <p className="mt-2 text-sm text-zinc-500">O pedido será mantido no histórico como cancelado e sairá do total do caixa.</p>
            <label className="mt-5 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Motivo do cancelamento</label>
            <textarea autoFocus required value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Ex: item lançado incorretamente" className="mt-2 min-h-24 w-full resize-none rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setCancelOpen(false)} className="h-10 rounded-lg border border-zinc-300 px-4 text-sm font-semibold dark:border-zinc-700">Voltar</button><button type="button" onClick={() => void cancelLoadedOrder()} disabled={busy || cancelReason.trim().length < 3} className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Cancelar pedido</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "neutral" }) {
  return <div className="min-w-28 border-l border-zinc-800 pl-3"><p className="text-[11px] font-medium uppercase text-zinc-500">{label}</p><p className={`mt-1 truncate text-sm font-semibold ${tone === "success" ? "text-emerald-400" : tone === "neutral" ? "text-amber-300" : "text-white"}`}>{value}</p></div>;
}

function ActionButton({ icon: Icon, label, onClick, primary, danger }: { icon: typeof UnlockKeyhole; label: string; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${primary ? "bg-emerald-400 text-zinc-950 hover:bg-emerald-300" : danger ? "border border-red-900 bg-red-950/60 text-red-200 hover:bg-red-950" : "border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"}`}><Icon size={16} aria-hidden />{label}</button>;
}
