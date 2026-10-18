import { WifiOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Full-screen state for "no network". There is no offline data, so the only action is retry. */
export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app px-6 text-center text-body">
      <WifiOffIcon className="size-12 text-faint" aria-hidden="true" />
      <h1 className="text-2xl font-semibold text-ink">You are offline</h1>
      <p className="max-w-xs text-soft">
        UniLink needs a connection to load your data. Check your network and try again.
      </p>
      <Button className="h-11 px-6" onClick={onRetry}>
        Retry
      </Button>
    </main>
  );
}
