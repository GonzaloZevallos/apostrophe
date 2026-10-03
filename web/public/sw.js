// Registered only when `window.isSecureContext` is true (`src/main.tsx`). No `fetch`
// handler and no Cache API (plan, "Install"): installable, but with no offline mode —
// a dropped connection shows "Sin conexión" straight from `navigator.onLine` and a
// failed request, never a cached response.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
