// Offline support for the Adelaide Deal Sheet app.
// Pages and the price list are fetched fresh when online (so Wednesday updates show up),
// and the last copy is used when the phone is offline.
const CACHE = "deal-sheet-v2";
const SHELL = ["./", "./index.html", "./history.html", "./data/prices.csv", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const fresh = sameOrigin && (req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith(".csv") || url.pathname.endsWith("/"));
  if (fresh){
    // network first, fall back to the saved copy
    const key = url.pathname.endsWith(".csv") ? "./data/prices.csv" : (url.pathname.endsWith("history.html") ? "./history.html" : "./index.html");
    // "no-cache" asks the server whether the page changed, so updates show on the very next open
    e.respondWith(fetch(url.href, {cache:"no-cache", credentials:"same-origin"}).then(res => {
      if (res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key)));
    return;
  }
  // everything else (icons, fonts, product photos): saved copy first, then network
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok && (sameOrigin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname))){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => hit)));
});
