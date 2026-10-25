import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRegisterSW } from "virtual:pwa-register/react";
import { FloatingNote } from "./FloatingNotes";

/**
 * Checks for a new service worker on launch and offers a reload when one is waiting, as a floating
 * pill above the tab bar. Dismissing hides it for this session; the next launch asks again.
 */
export function UpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      setRegistration(registration);
      // Launch check: the browser only re-checks on navigation, so ask explicitly.
      void registration?.update().catch(() => {});
    },
  });
  const [dismissed, setDismissed] = useState(false);
  if (!needRefresh || dismissed) return null;

  function reload() {
    const waiting = registration?.waiting;
    // The plugin reloads when the new worker takes control of this page. A page no worker controls
    // (hard reload, or Firefox with devtools' cache disabled) never sees that, so reload once the
    // new worker is active instead.
    if (!navigator.serviceWorker.controller) {
      if (!waiting) return window.location.reload();
      waiting.addEventListener("statechange", () => {
        if (waiting.state === "activated") window.location.reload();
      });
    }
    void updateServiceWorker(true);
  }

  return (
    <FloatingNote role="status" className="rounded-full" onDismiss={() => setDismissed(true)}>
      <span className="font-semibold text-ink">A new version is ready</span>
      <Button variant="ghost" size="sm" onClick={reload}>
        Reload
      </Button>
    </FloatingNote>
  );
}
