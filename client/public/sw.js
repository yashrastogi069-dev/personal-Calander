self.addEventListener("push", event => {
  let payload = { title: "Personal Calander", body: "You have a planning reminder.", url: "/" };
  try { payload = { ...payload, ...event.data?.json() }; } catch { /* use the safe default */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: payload.url || "/" },
    tag: payload.tag || "planning-reminder",
    renotify: false,
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
