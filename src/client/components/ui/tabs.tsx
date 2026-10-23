"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { focusRing } from "./focus";
import { press } from "./press";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva("group/tabs-list relative isolate w-fit text-soft", {
  variants: {
    variant: {
      // Segmented control: a `track` pill, 4px padding, equal columns, a `surface` thumb sliding behind.
      default: "inline-grid auto-cols-fr grid-flow-col rounded-full bg-track p-1",
      // Underlined: the active tab is marked by ink weight and a rule, not by color. Used by the mod nav until it is restyled.
      line: "inline-flex h-9 items-center justify-center gap-1 border-b border-line bg-transparent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {children}
      {variant === "default" ? (
        // The thumb moves with `translate` only (220ms); under reduced motion it jumps.
        <TabsPrimitive.Indicator
          data-slot="tabs-thumb"
          className="absolute inset-y-1 left-0 -z-10 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-surface motion-safe:transition-transform motion-safe:duration-220 motion-safe:ease-ui-out"
        />
      ) : null}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        `relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-soft outline-none ${press} ${focusRing} disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
        "data-active:text-ink",
        // Segmented: 40px buttons whose touch area reaches 44px through a -2px pseudo-element.
        `group-data-[variant=default]/tabs-list:min-h-10 group-data-[variant=default]/tabs-list:rounded-full group-data-[variant=default]/tabs-list:px-4 group-data-[variant=default]/tabs-list:text-sm group-data-[variant=default]/tabs-list:font-semibold group-data-[variant=default]/tabs-list:after:absolute group-data-[variant=default]/tabs-list:after:-inset-y-0.5 group-data-[variant=default]/tabs-list:after:inset-x-0 group-data-[variant=default]/tabs-list:after:content-['']`,
        "group-data-[variant=line]/tabs-list:h-full group-data-[variant=line]/tabs-list:px-3 group-data-[variant=line]/tabs-list:py-0.5 group-data-[variant=line]/tabs-list:text-sm group-data-[variant=line]/tabs-list:font-normal group-data-[variant=line]/tabs-list:hover:text-ink group-data-[variant=line]/tabs-list:data-active:font-semibold group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:inset-x-0 group-data-[variant=line]/tabs-list:after:-bottom-px group-data-[variant=line]/tabs-list:after:h-0.5 group-data-[variant=line]/tabs-list:data-active:after:bg-ink",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
