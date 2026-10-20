import { useEffect } from "react";
import { toast } from "@/lib/toast";
import { useRegisterSW } from "virtual:pwa-register/react";

const UPDATE_TOAST_ID = "pwa-update";

/** Checks for a new service worker on launch and offers a reload when one is waiting. */
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

  useEffect(() => {
    if (!needRefresh) return;
    toast("A new version is ready", {
      id: UPDATE_TOAST_ID,
      duration: Infinity,
      action: { label: "Reload", onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
