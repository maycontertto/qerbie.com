"use client";

import { useEffect, useMemo, useState } from "react";
import { toDataURL } from "qrcode";

export function TableQrPanel({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labelUrl = useMemo(() => {
    try {
      const parsed = new URL(url);
      const display = `${parsed.host}${parsed.pathname}${parsed.search}`;
      return display.length > 80 ? `${display.slice(0, 77)}…` : display;
    } catch {
      return url;
    }
  }, [url]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const next = await toDataURL(url, {
          errorCorrectionLevel: "M",
          margin: 2,
          scale: 6,
          width: 320,
          color: {
            dark: "#0a0a0a",
            light: "#ffffff",
          },
        });

        if (!cancelled) {
          setDataUrl(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setDataUrl(null);
          setError(e instanceof Error ? e.message : "Falha ao gerar o QR Code");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">QR para o cliente</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Opção 1: o cliente escaneia no celular. Opção 2: você abre e usa neste aparelho.
          </p>
        </div>
        <a
          href={url}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Usar neste aparelho
        </a>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[340px_1fr]">
        <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt="QR Code"
              className="h-auto w-[320px] max-w-full rounded-lg"
            />
          ) : error ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{error}</p>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Gerando QR Code…</p>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Link do QR</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{labelUrl}</p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            Quando o cliente abrir, ele só informa o nome para identificar o pedido (não cria conta).
          </p>
        </div>
      </div>
    </div>
  );
}
