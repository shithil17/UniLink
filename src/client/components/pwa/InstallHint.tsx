import { ShareIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { readInstallHintEnv, saveDismissed, shouldShowInstallHint } from "@/lib/installHint";

/** One-time "Add to Home Screen" hint for iOS Safari. Dismissal is remembered in localStorage. */
export function InstallHint() {
  const [visible, setVisible] = useState(() => shouldShowInstallHint(readInstallHintEnv()));
  if (!visible) return null;

  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-3 rounded-lg border border-line bg-surface p-3 text-sm text-body"
    >
      <p className="flex-1">
        Install UniLink: tap{" "}
        <ShareIcon className="mx-0.5 inline size-4 text-brand" aria-label="Share" /> then{" "}
        <strong className="text-ink">Add to Home Screen</strong>.
      </p>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss"
        onClick={() => {
          saveDismissed();
          setVisible(false);
        }}
      >
        <XIcon />
      </Button>
    </div>
  );
}
