"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "cn";
import { focusRing } from "./focus";

/** On/off control. Outlined when off, filled with the accent when on; the thumb never relies on color alone. */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        `peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-input bg-surface p-0.5 transition-colors outline-none after:absolute after:-inset-x-1 after:-inset-y-2.5 ${focusRing} disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary data-checked:bg-primary`,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full bg-input transition-transform data-checked:translate-x-5 data-checked:bg-primary-foreground"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
