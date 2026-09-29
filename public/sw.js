/* Flexr offline support.
 *
 * Gyms have thick walls. The aim is simple: once you've opened Flexr on a
 * device, it opens again with no signal, and everything you log is kept and
 * saved when the connection comes back.
 *
 * - Pages: network first (so you get the latest), falling back to the last
 *   copy we saw, and finally to the cached home page.
 * - Built assets, data files, photos and exercise animations: cache first,
 *   refreshed quietly in the background.
 * - Everything that talks to a server about your data (Supabase, food
 *   lookups) is left alone — those retry on their own.
 */
const VERSION = "flexr-v1";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const SHELL = ["/", "/login", "/manifest.webmanifest", "/icon-192.png"];

const IMAGE_HOSTS = ["raw.githubusercontent.com"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(PAGES).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) {
    // Refresh in the background; a stale asset is better than a spinner.
    fetch(req).then((res) => res.ok && cache.put(req, res.clone())).catch(() => {});
    return hit;
  }
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req)) || (await cache.match("/"));
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Anything that asks a server about food or accounts stays online-only.
    if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/exercises/gif/")) return;
    if (url.pathname.startsWith("/api/exercises/gif/")) return e.respondWith(cacheFirst(req, ASSETS));
    if (req.mode === "navigate") return e.respondWith(networkFirst(req));
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/data/") || /\.(png|svg|ico|webmanifest|json|woff2?)$/.test(url.pathname)) {
      return e.respondWith(cacheFirst(req, ASSETS));
    }
    return;
  }

  if (FONT_HOSTS.includes(url.hostname)) {
    // With no signal the page simply uses system fonts rather than logging an error.
    e.respondWith(cacheFirst(req, ASSETS).catch(() => new Response("", { status: 200, headers: { "Content-Type": "text/css" } })));
    return;
  }
  if (IMAGE_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(req, ASSETS));
  }
});
