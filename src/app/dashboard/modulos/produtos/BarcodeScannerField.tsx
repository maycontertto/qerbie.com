"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ScannerControls = {
  stop: () => void;
  switchTorch?: (onOff: boolean) => Promise<void>;
};

export function BarcodeScannerField({
  name,
  label,
  placeholder,
  defaultValue = "",
  value,
  onValueChange,
  helperText,
  lookupProduct,
}: {
  name?: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  helperText?: string;
  lookupProduct?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scannerControlsRef = useRef<ScannerControls | null>(null);
  const scannerTorchOnRef = useRef(false);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);
  const lookupSequenceRef = useRef(0);

  const [internalValue, setInternalValue] = useState(defaultValue);
  const [scannerOn, setScannerOn] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerTorchOn, setScannerTorchOn] = useState(false);
  const [scannerTorchSupported, setScannerTorchSupported] = useState(false);
  const [scannerLastRead, setScannerLastRead] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "not_found" | "error">("idle");
  const [lookupInfo, setLookupInfo] = useState<{ source: string; brand: string | null; quantity: string | null } | null>(null);

  const currentValue = value ?? internalValue;

  const applyValue = useCallback(
    (nextValue: string): void => {
      if (onValueChange) {
        onValueChange(nextValue);
        return;
      }
      setInternalValue(nextValue);
    },
    [onValueChange],
  );

  useEffect(() => {
    if (value === undefined) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue, value]);

  useEffect(() => {
    scannerTorchOnRef.current = scannerTorchOn;
  }, [scannerTorchOn]);

  useEffect(() => {
    if (!lookupProduct) return;
    const code = currentValue.trim();
    const sequence = ++lookupSequenceRef.current;
    setLookupInfo(null);
    if (!/^\d{8,14}$/.test(code)) {
      setLookupState("idle");
      return;
    }

    const timer = setTimeout(async () => {
      setLookupState("loading");
      try {
        const response = await fetch(`/api/dashboard/catalog/barcode?code=${encodeURIComponent(code)}`);
        if (sequence !== lookupSequenceRef.current) return;
        if (response.status === 404) {
          setLookupState("not_found");
          return;
        }
        if (!response.ok) throw new Error("lookup_failed");
        const product = await response.json() as { name: string; source: string; brand: string | null; quantity: string | null };
        if (sequence !== lookupSequenceRef.current) return;
        const form = inputRef.current?.form;
        const nameInput = form?.elements.namedItem("name");
        if (nameInput instanceof HTMLInputElement && !nameInput.value.trim()) {
          nameInput.value = product.name;
          nameInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        setLookupInfo({ source: product.source, brand: product.brand, quantity: product.quantity });
        setLookupState("found");
      } catch {
        if (sequence === lookupSequenceRef.current) setLookupState("error");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [currentValue, lookupProduct]);

  useEffect(() => {
    if (!scannerOn) {
      const controls = scannerControlsRef.current;
      if (controls?.switchTorch && scannerTorchOnRef.current) {
        void controls.switchTorch(false);
      }
      controls?.stop();
      scannerControlsRef.current = null;
      setScannerTorchOn(false);
      setScannerTorchSupported(false);
      setScannerError(null);
      setScannerLastRead("");
      return;
    }

    let cancelled = false;

    async function start() {
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
            "Este navegador não disponibiliza câmera aqui. Abra no Chrome/Safari e em HTTPS.",
          );
          return;
        }

        if (!isSecure) {
          setScannerTorchSupported(false);
          setScannerError("A câmera só funciona em HTTPS ou localhost.");
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
          if (!result || cancelled) return;

          const resolved = result as { getText?: () => string; text?: string };
          const text = String(resolved.getText?.() ?? resolved.text ?? "").trim();
          if (!text) return;

          const now = Date.now();
          const last = lastScanRef.current;
          if (last && last.text === text && now - last.at < 2000) return;
          lastScanRef.current = { text, at: now };

          setScannerLastRead(text);
          applyValue(text);
          setScannerOn(false);
        };

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "environment" },
        });

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
      } catch (err) {
        const name =
          err && typeof err === "object" && "name" in err && typeof (err as { name?: unknown }).name === "string"
            ? String((err as { name: string }).name)
            : "";

        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setScannerError("Permita o acesso à câmera para ler o código de barras.");
          return;
        }

        setScannerError("Não foi possível iniciar a câmera neste dispositivo agora.");
      }
    }

    void start();

    return () => {
      cancelled = true;
      const controls = scannerControlsRef.current;
      if (controls?.switchTorch && scannerTorchOnRef.current) {
        void controls.switchTorch(false);
      }
      controls?.stop();
      scannerControlsRef.current = null;
    };
  }, [applyValue, scannerOn]);

  async function toggleTorch(): Promise<void> {
    const controls = scannerControlsRef.current;
    if (!controls?.switchTorch) return;
    const next = !scannerTorchOnRef.current;
    try {
      await controls.switchTorch(next);
      setScannerTorchOn(next);
    } catch {
      setScannerError("Não foi possível alternar a lanterna nesta câmera.");
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</label>
      <div className="mt-1 flex gap-2">
        <input
          ref={inputRef}
          name={name}
          type="text"
          inputMode="numeric"
          value={currentValue}
          onChange={(event) => applyValue(event.target.value)}
          placeholder={placeholder}
          className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          type="button"
          onClick={() => setScannerOn((current) => !current)}
          className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {scannerOn ? "Fechar câmera" : "Ler código"}
        </button>
      </div>
      {helperText ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{helperText}</p> : null}
      {lookupProduct && lookupState === "loading" ? <p className="mt-1 text-xs text-zinc-500" aria-live="polite">Buscando os dados do produto…</p> : null}
      {lookupProduct && lookupState === "not_found" ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300" aria-live="polite">Produto não localizado na base. Você pode preencher os dados manualmente.</p> : null}
      {lookupProduct && lookupState === "error" ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300" aria-live="polite">A busca não está disponível agora; continue o cadastro manualmente.</p> : null}
      {lookupProduct && lookupState === "found" && lookupInfo ? (
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300" aria-live="polite">
          Encontrado em <a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer" className="underline">{lookupInfo.source}</a>{lookupInfo.brand ? ` · ${lookupInfo.brand}` : ""}{lookupInfo.quantity ? ` · ${lookupInfo.quantity}` : ""}. Confira os dados antes de salvar.
        </p>
      ) : null}

      {scannerOn ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Aponte a câmera para o código de barras
            </p>
            {scannerTorchSupported ? (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {scannerTorchOn ? "Desligar lanterna" : "Ligar lanterna"}
              </button>
            ) : null}
          </div>

          <video
            ref={videoRef}
            className="mt-3 aspect-video w-full rounded-lg border border-zinc-200 bg-black object-cover dark:border-zinc-800"
            autoPlay
            muted
            playsInline
          />

          {scannerLastRead ? (
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
              Última leitura: {scannerLastRead}
            </p>
          ) : null}

          {scannerError ? (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{scannerError}</p>
          ) : (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Dica: aproxime o código e tente em um ambiente bem iluminado.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
