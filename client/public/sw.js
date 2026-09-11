/*__PERSONAL_CALENDAR_PWA_BUILD__*/

const pwaBuild = self.__PERSONAL_CALENDAR_PWA_BUILD__ || {
  release: "development",
  precache: ["/", "/offline.html", "/manifest.webmanifest", "/icon.svg"],
};
const ownedCachePrefix = "personal-calander-";
const shellCache = `${ownedCachePrefix}shell-${pwaBuild.release}`;
const runtimeCache = `${ownedCachePrefix}runtime-v1`;
const runtimeLimit = 40;
const runtimeMaxAgeMs = 7 * 24 * 60 * 60 * 1000;
const cachedAtHeader = "x-personal-calendar-cached-at";

function isSafeResponse(response) {
  return response.ok && !response.redirected && (response.type === "basic" || response.type === "default");
}

async function installShell() {
  const responses = await Promise.all(pwaBuild.precache.map(async url => {
    const response = await fetch(new Request(url, { cache: "reload", credentials: "same-origin" }));
    if (!isSafeResponse(response)) throw new Error(`Unsafe shell response for ${url}`);
    return [url, response];
  }));
  const cache = await caches.open(shellCache);
  await Promise.all(responses.map(([url, response]) => cache.put(url, response)));
}

self.addEventListener("install", event => {
  event.waitUntil(installShell());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name.startsWith(ownedCachePrefix) && name !== shellCache && name !== runtimeCache)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "personal-calendar:activate-update") event.waitUntil(self.skipWaiting());
});

async function navigationResponse(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (isSafeResponse(response)) return response;
    throw new Error("Navigation returned an unsafe response");
  } catch {
    return (await caches.match("/")) || (await caches.match("/offline.html")) || Response.error();
  } finally {
    clearTimeout(timeout);
  }
}

async function trimRuntimeCache(cache) {
  const keys = await cache.keys();
  const expired = [];
  for (const key of keys) {
    const response = await cache.match(key);
    const cachedAt = Number(response?.headers.get(cachedAtHeader) || 0);
    if (!cachedAt || Date.now() - cachedAt > runtimeMaxAgeMs) expired.push(key);
  }
  await Promise.all(expired.map(key => cache.delete(key)));
  const retained = await cache.keys();
  const remaining = retained.slice(0, Math.max(0, retained.length - runtimeLimit));
  await Promise.all(remaining.map(key => cache.delete(key)));
}

async function putRuntime(cache, request, response) {
  const headers = new Headers(response.headers);
  headers.set(cachedAtHeader, String(Date.now()));
  const stamped = new Response(await response.clone().blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  await cache.put(request, stamped);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (!isSafeResponse(response)) return response;
  const cache = await caches.open(runtimeCache);
  await putRuntime(cache, request, response);
  await trimRuntimeCache(cache);
  return response;
}

async function refreshRuntime(request) {
  const response = await fetch(request);
  if (isSafeResponse(response)) {
    const cache = await caches.open(runtimeCache);
    await putRuntime(cache, request, response);
    await trimRuntimeCache(cache);
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (/^\/assets\/.*\.(?:css|js)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname === "/manifest.webmanifest" || url.pathname === "/icon.svg" || url.pathname.startsWith("/icons/")) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const update = refreshRuntime(request).catch(() => null);
      event.waitUntil(update);
      return cached || (await update) || Response.error();
    })());
  }
});

self.addEventListener("push", event => {
  let payload = { title: "Personal Calendar", body: "You have a planning reminder.", url: "/", kind: "reminder" };
  try { payload = { ...payload, ...event.data?.json() }; } catch { /* use the safe default */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/", kind: payload.kind || "reminder" },
    tag: payload.tag || "planning-reminder",
    renotify: false,
  }));
});

function safeNotificationTarget(candidate) {
  try {
    const target = new URL(candidate || "/", self.location.origin);
    if (target.origin !== self.location.origin) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = safeNotificationTarget(event.notification.data?.url);
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
