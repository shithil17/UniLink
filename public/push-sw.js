// Web Push handlers, loaded into the generated service worker with importScripts.
// A push carries only server-built text ({ title, body, url }); this file never builds copy from user data.

const FALLBACK = { title: "UniLink", body: "You have a new notification", url: "/inbox" };

// Only same-origin paths ("/inbox"), never "//host" or a full URL.
function isAppPath(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//");
}

function readMessage(event) {
  if (!event.data) return FALLBACK;
  try {
    const data = event.data.json();
    return {
      title: typeof data.title === "string" && data.title ? data.title : FALLBACK.title,
      body: typeof data.body === "string" && data.body ? data.body : FALLBACK.body,
      // Only same-origin paths: a push can never send the user elsewhere.
      url: isAppPath(data.url) ? data.url : FALLBACK.url,
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
      // One slot: a newer notification replaces the older one instead of stacking. `renotify`
      // makes the replacement alert again (sound, vibration, heads-up); without it, it is silent.
      tag: "inbox",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url },
    }),
  );
});

// The app listens for this message and routes in place (see src/client/main.tsx).
const NAVIGATE_MESSAGE = "unilink:navigate";

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data;
  const path = isAppPath(data?.url) ? data.url : FALLBACK.url;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(path);
      // navigate() quietly does nothing for some clients (it resolves null), so the open app is
      // asked to route itself instead. It is a single-page app, so no reload is needed.
      await open.focus();
      open.postMessage({ type: NAVIGATE_MESSAGE, url: path });
    }),
  );
});
