const appShellCache = "personal-calander-shell-v1";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(appShellCache).then(cache => cache.add("/")).catch(() => undefined));
  self.skipWaiting();
});
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      void caches.open(appShellCache).then(cache => cache.put("/", copy));
      return response;
    }).catch(async () => (await caches.match("/")) || Response.error()));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      void caches.open(appShellCache).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});

self.addEventListener("push", event => {
  let payload = { title: "Personal Calander", body: "You have a planning reminder.", url: "/", kind: "reminder" };
  try { payload = { ...payload, ...event.data?.json() }; } catch { /* use the safe default */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: payload.url || "/", kind: payload.kind || "reminder" },
    tag: payload.tag || "planning-reminder",
    renotify: false,
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.focus(); existing.postMessage({ type: "personal-calander:notification-click", targetUrl }); return; }
    await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener("pushsubscriptionchange", event => {
  event.waitUntil((async () => {
    try {
      const applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
      const subscription = await self.registration.pushManager.subscribe({ userVisibleOnly: true, ...(applicationServerKey ? { applicationServerKey } : {}) });
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach(client => client.postMessage({ type: "personal-calander:subscription-changed", subscription: subscription.toJSON() }));
    } catch {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach(client => client.postMessage({ type: "personal-calander:subscription-refresh-needed" }));
    }
  })());
});
