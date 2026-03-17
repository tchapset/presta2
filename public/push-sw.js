// Push notification service worker
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "PRESTA237", body: event.data.text() };
  }

  const options = {
    body: data.body || data.message || "",
    icon: "/presta237-logo.png",
    badge: "/presta237-logo.png",
    tag: data.tag || `presta237-${Date.now()}`,
    data: { url: data.url || data.link || "/" },
    vibrate: [200, 100, 200],
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(data.title || "PRESTA237", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
