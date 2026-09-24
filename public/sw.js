/* Minimal PWA service worker for Qerbie */

const CACHE_NAME = "qerbie-pwa-v4";
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/maskable-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && (url.pathname === "/" || url.pathname === "/auth/sign-in")) {
    const offlineKey = new Request(`${self.location.origin}/dashboard/modulos/vendas/caixa`);
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.delete(offlineKey)));
      return response;
    }).catch(async () => {
      const cached = await caches.match(offlineKey);
      return cached ? Response.redirect(offlineKey.url, 302) : Response.error();
    }));
    return;
  }

  // Cache only the authenticated point-of-sale app shell for offline reloads.
  // All account data and API requests still require a live authenticated request.
  if (request.mode === "navigate" && url.pathname === "/dashboard/modulos/vendas/caixa") {
    const offlineKey = new Request(`${self.location.origin}/dashboard/modulos/vendas/caixa`);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && new URL(response.url).pathname === "/dashboard/modulos/vendas/caixa") {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(offlineKey, copy)).catch(() => undefined));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(offlineKey);
          return cached || Response.error();
        }),
    );
    return;
  }

  // Never cache API or auth-like endpoints.
  if (url.pathname.startsWith("/api")) return;
  if (url.pathname.startsWith("/auth")) return;

  // Never cache other authenticated/console routes.
  if (url.pathname.startsWith("/dashboard")) return;
  if (url.pathname.startsWith("/atendente")) return;

  // Network-first for navigations (keeps app fresh).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match("/");
          return fallback || Response.error();
        }),
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/pwa/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/sw.js";

  if (!isStaticAsset) return;

  // Cache-first for static assets only.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
        return response;
      });
    }),
  );
});
