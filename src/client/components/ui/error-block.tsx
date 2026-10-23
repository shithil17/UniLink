import * as React from "react";
import { TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/**
 * A block that failed to load, shown in the block's own place (not a toast, which is for action
 * results). A `danger-soft` panel with a `danger` alert icon and `ink` text; Retry sits inside it
 * and calls `onRetry`. Say what failed in `title` and what to expect in `message`.
 */
function ErrorBlock({
  title = "Couldn't load this",
  message,
  onRetry,
  retrying = false,
  retryLabel = "Retry",
  className,
}: {
  title?: string;
  message?: React.ReactNode;
  onRetry: () => void;
  /** Shows the Retry button busy while the refetch runs. */
  retrying?: boolean;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      data-slot="error-block"
      className={cn(
        "flex items-start gap-3 rounded-panel bg-danger-soft p-4 text-ink md:rounded-[24px]",
        className,
      )}
    >
      <TriangleAlertIcon
        aria-hidden
        strokeWidth={1.75}
        className="mt-0.5 size-5 shrink-0 text-danger"
      />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="font-semibold">{title}</p>
        {message ? <p className="text-sm">{message}</p> : null}
        <Button
          variant="outline"
          size="sm"
          loading={retrying}
          onClick={onRetry}
          className="mt-3 justify-self-start"
        >
          {retryLabel}
        </Button>
      </div>
    </div>
  );
}

export { ErrorBlock };
