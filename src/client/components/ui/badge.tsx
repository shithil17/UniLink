import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { focusRing } from "./focus";

const badgeVariants = cva(
  `group/badge inline-flex min-h-[22px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full px-[9px] text-xs leading-none font-semibold whitespace-nowrap ${focusRing} has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!`,
  {
    variants: {
      variant: {
        // Plain label for a state that is not a course state (for example "Excluded").
        outline: "text-ink inset-ring-1 inset-ring-edge [a]:hover:bg-tint",
        solid: "bg-primary text-primary-foreground",
        soft: "bg-brand-soft text-brand-ink",
        // Course hue: read from the nearest `data-hue` wrapper. Course data only.
        hue: "bg-hue text-hue-ink",
        // A number on a queue that needs action; a solid pill at least as wide as it is tall.
        count: "min-w-[22px] bg-primary px-1.5 text-primary-foreground",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

function Badge({
  className,
  variant = "outline",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
