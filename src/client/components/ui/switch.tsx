"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "cn";

/**
 * On/off control: a 52x32 track (`edge` off, `brand` on) with a 24px thumb inset 4px, and the word
 * On or Off beside it so state never relies on color alone. The whole row is the 48px hit target.
 * The word is generated content in an `aria-hidden` span: it is visible but never part of the
 * accessible name, which still comes from the caller's label or `aria-label`.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group/switch peer inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-3 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        data-slot="switch-track"
        className="relative h-8 w-13 shrink-0 rounded-full bg-edge group-data-checked/switch:bg-primary group-focus-visible/switch:outline-3 group-focus-visible/switch:outline-offset-2 group-focus-visible/switch:outline-solid group-focus-visible/switch:outline-brand"
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className="pointer-events-none absolute top-1 left-1 block size-6 rounded-full bg-surface group-data-checked/switch:translate-x-5 group-data-checked/switch:bg-primary-foreground motion-safe:transition-transform motion-safe:duration-180 motion-safe:ease-ui-out motion-safe:group-active/switch:scale-x-110"
        />
      </span>
      <span
        aria-hidden
        data-slot="switch-state"
        className="min-w-7 text-sm font-medium text-ink after:content-['Off'] group-data-checked/switch:after:content-['On']"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
