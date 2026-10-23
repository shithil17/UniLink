import * as React from "react";
import { cn } from "cn";
import { focusRingInset } from "./focus";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        `flex field-sizing-content min-h-20 w-full rounded-control border-[1.5px] border-input bg-surface px-3.5 py-3 text-base text-ink outline-none placeholder:text-faint ${focusRingInset} disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-faint aria-invalid:border-destructive aria-invalid:outline-destructive`,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
