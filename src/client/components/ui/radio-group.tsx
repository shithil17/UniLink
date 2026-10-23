import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "cn";
import { focusRing } from "./focus";
import { press } from "./press";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid w-full gap-2", className)}
      {...props}
    />
  );
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        `group/radio-group-item peer relative flex aspect-square size-6 shrink-0 rounded-full border-[1.5px] border-input bg-surface outline-none after:absolute after:-inset-2.5 ${focusRing} disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:aria-checked:border-primary data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground`,
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-full items-center justify-center"
      >
        <span className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

/**
 * A radio drawn as a tile, for a short grid of choices (the grade picker). Same primitive, so arrow
 * keys, the roving tab stop and form state work as for any radio. The checked tile gets a 2px
 * `brand` edge as well as the soft fill, so the choice is never color alone. Put the label and any
 * detail line in `children`; give it an `aria-label` that starts with the visible text.
 */
function RadioChip({ className, children, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-chip"
      className={cn(
        `group/radio-chip relative grid min-h-13 cursor-pointer content-center justify-items-center gap-0.5 rounded-[14px] border-2 border-transparent bg-app text-ink outline-none select-none ${press} ${focusRing} hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-brand data-checked:bg-brand-soft data-checked:text-brand-ink`,
        className,
      )}
      {...props}
    >
      {children}
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem, RadioChip };
