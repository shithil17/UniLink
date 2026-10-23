import * as React from "react";
import { InboxIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";

/**
 * A block with nothing in it yet: a 56px `brand-soft` circle holding a `brand-ink` icon, a 18/600
 * title, and a line of `soft` text capped at 30 characters. `action` takes the one next step (a
 * button or link). Keep the title in the product's own words ("No classes today"), not "No data".
 */
function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn("grid justify-items-center gap-2 px-6 py-8 text-center", className)}
    >
      <span className="mb-1 grid size-14 place-items-center rounded-full bg-brand-soft text-brand-ink">
        <Icon aria-hidden strokeWidth={1.75} className="size-6" />
      </span>
      <h3 className="text-lg leading-[1.3] font-semibold text-ink">{title}</h3>
      {description ? <p className="max-w-[30ch] text-soft">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
