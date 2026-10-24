import { WifiOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Full-screen state for "no network". There is no offline data, so the only action is retry. */
export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-4 text-body">
      <EmptyState
        icon={WifiOffIcon}
        title="You're offline"
        description="UniLink loads everything live, so it needs a connection. Check your network and try again."
        action={
          <Button size="lg" className="px-6" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    </main>
  );
}
