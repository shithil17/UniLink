import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A summary tile: flat and borderless, radius 20 (24 from `md`), padding 16, at least 140px tall.
 * `accent` is `brand-soft` with `brand-ink` text; `plain` is `surface`. Tiles never nest and never
 * cast a shadow. Put a `Figure` in it for the 40/700 number.
 */
export function Tile({
  tone,
  className,
  children,
  ...props
}: {
  tone: "accent" | "plain";
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentProps<"div">, "className" | "children">) {
  return (
    <div
      data-slot="tile"
      data-tone={tone}
      className={cn(
        "flex min-h-[140px] min-w-0 flex-col justify-between gap-3 rounded-panel p-4 md:rounded-[24px]",
        tone === "accent" ? "bg-brand-soft text-brand-ink" : "bg-surface text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** The 40/700 figure of a tile, tracking -0.02em. */
export function Figure({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-[40px] leading-none font-bold tracking-[-0.02em] tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

/** A tile caption, 13/500. Tone it with `text-soft` on a plain tile. */
export function Caption({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-[13px] leading-[1.3] font-medium", className)} {...props} />;
}
