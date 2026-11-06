/* Notifications from the Love tab, added to the service worker that
   vite-plugin-pwa builds (workbox importScripts in vite.config.js).
   The love-push function sends { title, body, url, tag, badge }. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "Personal Hub", body: event.data ? event.data.text() : "" };
  }
  const shows = [
    self.registration.showNotification(data.title || "Personal Hub", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/love" },
    }),
  ];
  if (typeof data.badge === "number" && self.navigator && "setAppBadge" in self.navigator) {
    shows.push(self.navigator.setAppBadge(data.badge).catch(() => {}));
  }
  event.waitUntil(Promise.all(shows));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/love", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((c) => (c && "navigate" in c ? c.navigate(url) : c));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
