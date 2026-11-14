/* Bump this version whenever the fallback document changes. */
const CACHE_PREFIX = "money-tracker-offline-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const OFFLINE_URL = "/offline/";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const response = await fetch(new Request(OFFLINE_URL, { cache: "reload" }));
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      throw new Error("Offline document could not be installed");
    }
    const cache = await caches.open(CACHE_NAME);
    await cache.put(OFFLINE_URL, response);
  })());
  // Deliberately no skipWaiting: updates must not interrupt active forms.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // API/auth, mutations, subresources, RSC fetches and other origins bypass us.
  if (url.origin !== self.location.origin || request.method !== "GET" ||
      url.pathname === "/api" || url.pathname.startsWith("/api/") ||
      request.mode !== "navigate") return;

  event.respondWith((async () => {
    try {
      // Preserve actual HTTP errors; only transport failures use the fallback.
      return await fetch(request);
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(OFFLINE_URL)) || Response.error();
    }
  })());
});
