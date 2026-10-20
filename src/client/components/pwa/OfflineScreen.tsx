import { WifiOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Full-screen state for "no network". There is no offline data, so the only action is retry. */
export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-app px-6 text-center text-body">
      <WifiOffIcon className="size-6 text-faint" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-ink">You're offline</h1>
      <p className="max-w-xs text-sm text-soft">
        UniLink loads everything live, so it needs a connection. Check your network and try again.
      </p>
      <Button size="lg" className="mt-2 px-6" onClick={onRetry}>
        Retry
      </Button>
    </main>
  );
}
