import * as React from "react";
import { cn } from "cn";
import { focusRingInset } from "./focus";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        `flex field-sizing-content min-h-20 w-full rounded-control border border-input bg-surface px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground ${focusRingInset} disabled:cursor-not-allowed disabled:bg-tint disabled:opacity-60 aria-invalid:border-destructive aria-invalid:outline-destructive md:text-sm`,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
