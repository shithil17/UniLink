import type { ComponentProps } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/**
 * A round 44px control floating on a map: `surface` with the floating-layer shadow, never glass. It
 * is the close, zoom and "Fit" button of a full-screen map; give it an `aria-label` when it holds
 * only an icon.
 */
export function MapControlButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("bg-surface text-ink shadow-float", className)}
      {...props}
    />
  );
}
