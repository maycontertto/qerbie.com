"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

export function CaixaClient() {
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
        setStatus({ kind: "error", message: "Não foi possível finalizar a venda." });
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
    } catch {
      setStatus({ kind: "error", message: "Não foi possível finalizar a venda." });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Adicionar item</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Digite o nome para buscar, ou um código de barras para adicionar direto (Enter).
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Nome ou código
            </label>
            <input
              ref={inputRef}
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (busy) return;

                const q = itemQuery.trim();
                if (!q) return;
                if (isLikelyBarcode(q)) {
                  void addByBarcode(q);
                } else {
                  void searchProducts(q);
                }
              }}
              placeholder="Ex: Coca-Cola 2L ou 7891234567890"
              inputMode="search"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const q = itemQuery.trim();
                if (!q) return;
                if (isLikelyBarcode(q)) {
                  void addByBarcode(q);
                } else {
                  void searchProducts(q);
                }
              }}
              disabled={busy || !itemQuery.trim()}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Buscar / adicionar
            </button>

            <button
              type="button"
              onClick={() => setScannerOn((v) => !v)}
              disabled={busy}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              {scannerOn ? "Parar câmera" : "Ler com câmera"}
            </button>
          </div>
        </div>

        {searchResults.length ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Resultados
            </p>
            <ul className="mt-3 space-y-2">
              {searchResults.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatBrl(Number(p.price ?? 0))}{p.barcode ? ` • ${p.barcode}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      addProductToCart({
                        id: p.id,
                        name: p.name,
                        price: Number(p.price ?? 0),
                        unitLabel: String(p.unitLabel ?? "un"),
                      });
                      setItemQuery("");
                      setSearchResults([]);
                      inputRef.current?.focus();
                    }}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Adicionar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {scannerOn ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Leitor por câmera
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {scannerTorchSupported ? (
                  <button
                    type="button"
                    onClick={() => setScannerTorchOn((v) => !v)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {scannerTorchOn ? "Lanterna: ligada" : "Lanterna: desligada"}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setScannerOn(false)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Parar
                </button>
              </div>
            </div>

            {scannerError ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {scannerError}
              </div>
            ) : null}

            <video
              ref={videoRef}
              className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-950 dark:border-zinc-800"
              muted
              playsInline
              autoPlay
            />

            <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              <span className="font-semibold">Último lido:</span> {scannerLastRead ? scannerLastRead : "—"}
            </div>

            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Aponte para o código de barras. Ao ler, ele adiciona no carrinho automaticamente.
            </p>
          </div>
        ) : null}

        {status.kind !== "idle" && status.message ? (
          <div
            className={`mt-4 rounded-2xl border p-3 text-sm ${
              status.kind === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {status.message}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pedido (QR / comprovante)</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Busque pelo número do pedido e envie o cupom não fiscal no WhatsApp.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Número do pedido
            </label>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (busy) return;
                void loadOrder(orderNumber);
              }}
              placeholder="Ex: 12"
              inputMode="numeric"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Telefone do cliente
            </label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Ex: (11) 99999-9999"
              inputMode="tel"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadOrder(orderNumber)}
            disabled={busy || !orderNumber.trim()}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Carregar pedido
          </button>

          <button
            type="button"
            onClick={() => openWhatsAppWithReceipt()}
            disabled={busy || !loadedOrder}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Enviar cupom no WhatsApp
          </button>
        </div>

        {loadedOrder ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Pedido #{loadedOrder.order.orderNumber}
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {formatBrl(Number(loadedOrder.order.total ?? 0))}
              </p>
            </div>

            <ul className="mt-3 space-y-1">
              {loadedOrder.order.items.map((i, idx) => (
                <li key={`${i.productId ?? "item"}-${idx}`} className="text-xs text-zinc-600 dark:text-zinc-300">
                  {formatQty(Number(i.quantity ?? 0))} {String(i.unitLabel ?? "un")} × {i.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pagamento</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Selecione como o cliente pagou para registrar na venda.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Forma
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="cash">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="card">Cartão</option>
              <option value="other">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Observação
            </label>
            <input
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Opcional (ex: Pix Nubank, débito, 2x)"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Carrinho</h2>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Total: {formatBrl(total)}</div>
        </div>

        {cart.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Nenhum item ainda.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {cart.map((item) => (
              <li key={item.productId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatQty(item.quantity)} {item.unitLabel} × {formatBrl(item.unitPrice)} = {formatBrl(item.unitPrice * item.quantity)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.001}
                    step={0.001}
                    value={String(item.quantity)}
                    disabled={busy}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const n = Number(raw);
                      const qty = Number.isFinite(n) ? Math.max(0.001, Math.round(n * 1000) / 1000) : 1;
                      setCart((prev) =>
                        prev.map((p) => (p.productId === item.productId ? { ...p, quantity: qty } : p)),
                      );
                    }}
                    className="h-9 w-24 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    aria-label={`Quantidade (${item.unitLabel})`}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCart((prev) => {
                        const next = prev
                          .map((p) =>
                            p.productId === item.productId
                              ? { ...p, quantity: Math.max(0.001, Math.round((p.quantity - 1) * 1000) / 1000) }
                              : p,
                          )
                          .filter(Boolean);
                        return next;
                      });
                    }}
                    className="h-9 w-9 rounded-lg border border-zinc-300 bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCart((prev) =>
                        prev.map((p) =>
                          p.productId === item.productId ? { ...p, quantity: p.quantity + 1 } : p,
                        ),
                      );
                    }}
                    className="h-9 w-9 rounded-lg border border-zinc-300 bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCart((prev) => prev.filter((p) => p.productId !== item.productId))}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void finalizeSale()}
            disabled={busy || cart.length === 0}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Finalizar venda
          </button>

          <button
            type="button"
            onClick={() => {
              setCart([]);
              setStatus({ kind: "idle" });
              setItemQuery("");
              setSearchResults([]);
              inputRef.current?.focus();
            }}
            disabled={busy || cart.length === 0}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Limpar
          </button>
        </div>
      </section>
    </div>
  );
}
