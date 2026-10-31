// Weblua's offline support. Hashed /assets/ files never change, so a cached
// copy is served first. Pages, icons, and the manifest come from the network
// while online, so a deploy shows on the next visit, and from the cache offline.
// Runtimes and the Luau analyzer are cached the first time a run or check
// fetches them, so a project that ran once online can run again offline.
//
// Keep CACHE in step with src/main.tsx, which adds the files the first visit
// loaded before this worker took control.
// shortcut: old hashed assets stay cached after a deploy; rename CACHE (which
// starts it empty) if the cache ever grows large enough to matter.
const CACHE = "weblua-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(url.pathname.startsWith("/assets/") ? cacheFirst(request) : networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  // ignoreVary: module scripts send an Origin header the cached request may lack,
  // and a file whose name is its hash is the same file either way.
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    // A redirect (nginx folding /playground/ into /playground) is not .ok, so it is never cached.
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
    if (cached) return cached;
    // A page never opened online still opens offline as the playground, if that was.
    const playground = request.mode === "navigate" ? await cache.match("/playground", { ignoreVary: true }) : undefined;
    if (playground) return playground;
    throw error;
  }
}
