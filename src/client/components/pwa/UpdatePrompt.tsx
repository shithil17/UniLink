import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRegisterSW } from "virtual:pwa-register/react";
import { FloatingNote } from "./FloatingNotes";

/**
 * Checks for a new service worker on launch and offers a reload when one is waiting, as a floating
 * pill above the tab bar. Dismissing hides it for this session; the next launch asks again.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Launch check: the browser only re-checks on navigation, so ask explicitly.
      void registration?.update().catch(() => {});
    },
  });
  const [dismissed, setDismissed] = useState(false);
  if (!needRefresh || dismissed) return null;

  return (
    <FloatingNote role="status" className="rounded-full" onDismiss={() => setDismissed(true)}>
      <span className="font-semibold text-ink">A new version is ready</span>
      <Button variant="ghost" size="sm" onClick={() => void updateServiceWorker(true)}>
        Reload
      </Button>
    </FloatingNote>
  );
}
