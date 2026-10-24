import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";
import { focusRingInset } from "./focus";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        `min-h-12 w-full min-w-0 rounded-control border-[1.5px] border-input bg-surface px-3.5 py-2 text-base text-ink outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-faint ${focusRingInset} disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-faint aria-invalid:border-destructive aria-invalid:outline-destructive`,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
