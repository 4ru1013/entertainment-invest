const CACHE_NAME = "entertainment-invest-v3-3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  // 不再使用舊版的 cache-first。
  // 網路正常時永遠先取得 GitHub Pages 最新版本。
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
