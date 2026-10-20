// Web Push handlers, loaded into the generated service worker with importScripts.
// A push carries only server-built text ({ title, body, url }); this file never builds copy from user data.

const FALLBACK = { title: "UniLink", body: "You have a new notification", url: "/inbox" };

function readMessage(event) {
  if (!event.data) return FALLBACK;
  try {
    const data = event.data.json();
    return {
      title: typeof data.title === "string" && data.title ? data.title : FALLBACK.title,
      body: typeof data.body === "string" && data.body ? data.body : FALLBACK.body,
      // Only same-origin paths: a push can never send the user elsewhere.
      url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : FALLBACK.url,
    };
  } catch {
    return FALLBACK;
  }
}

self.addEventListener("push", (event) => {
  const { title, body, url } = readMessage(event);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      // One slot: a newer notification replaces the older one instead of stacking.
      tag: "inbox",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? FALLBACK.url, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        // navigate() can reject on an uncontrolled client; fall back to a new window.
        return open.navigate(url).catch(() => self.clients.openWindow(url));
      }
      return self.clients.openWindow(url);
    }),
  );
});
