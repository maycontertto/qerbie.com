"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navAny: any = navigator;
  const iosStandalone = Boolean(navAny.standalone);
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const [desktopHintOpen, setDesktopHintOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [isMobile] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(max-width: 768px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "qerbie:pwa-dismissed-until";
    const raw = window.localStorage.getItem(key);
    const until = raw ? Number(raw) : 0;
    if (Number.isFinite(until) && until > Date.now()) return;

    const t = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  const showIos = useMemo(() => {
    return !deferred && isIos() && !isStandalone();
  }, [deferred]);

  const showDesktopHint = useMemo(() => {
    return !deferred && !showIos && !isMobile && !isStandalone();
  }, [deferred, showIos, isMobile]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!ready) return null;
  if (dismissed) return null;
  if (!deferred && !showIos && !showDesktopHint) return null;

  async function onInstall() {
    if (deferred) {
      await deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        // ignore
      }
      setDeferred(null);
      setDismissed(true);
      return;
    }

    // iOS: show inline hint
    if (showIos) {
      setIosHintOpen((v) => !v);
      return;
    }

    // Desktop: show inline hint
    setDesktopHintOpen((v) => !v);
  }

  function onDismiss() {
    if (typeof window !== "undefined") {
      const key = "qerbie:pwa-dismissed-until";
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      window.localStorage.setItem(key, String(Date.now() + sevenDays));
    }
    setDismissed(true);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto max-w-xl rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Instalar app</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Instale o Qerbie para abrir mais rápido.
            </p>
            {showIos && iosHintOpen ? (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                No iPhone: toque em “Compartilhar” e depois “Adicionar à Tela de Início”.
              </p>
            ) : null}
            {showDesktopHint && desktopHintOpen ? (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                No Windows: use Edge/Chrome e clique em “Instalar” na barra de endereços ou no menu.
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onInstall}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {deferred ? "Instalar" : "Ver como instalar"}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
