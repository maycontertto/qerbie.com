/* Minimal PWA service worker for Qerbie */

const CACHE_NAME = "qerbie-pwa-v3";
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

  // Never cache API or auth-like endpoints.
  if (url.pathname.startsWith("/api")) return;
  if (url.pathname.startsWith("/auth")) return;

  // Never cache authenticated/console routes.
  // These pages change frequently and must always reflect the latest deploy.
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
