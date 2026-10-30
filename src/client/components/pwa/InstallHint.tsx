import { ShareIcon } from "lucide-react";
import { useState } from "react";
import { readInstallHintEnv, saveDismissed, shouldShowInstallHint } from "@/lib/installHint";
import { FloatingNote } from "./FloatingNotes";

/** One-time "Add to Home Screen" hint for iOS browsers that can add to the Home Screen. Dismissal is remembered in localStorage. */
export function InstallHint() {
  const [visible, setVisible] = useState(() => shouldShowInstallHint(readInstallHintEnv()));
  if (!visible) return null;

  return (
    <FloatingNote
      role="note"
      onDismiss={() => {
        saveDismissed();
        setVisible(false);
      }}
    >
      <p className="flex-1 py-1.5">
        Keep UniLink on your home screen: tap{" "}
        <ShareIcon className="mx-0.5 inline size-4 text-ink" aria-label="Share" />, then{" "}
        <strong className="font-semibold text-ink">Add to Home Screen</strong>.
      </p>
    </FloatingNote>
  );
}
