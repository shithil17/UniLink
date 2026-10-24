import { Link, useRouterState } from "@tanstack/react-router";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { activeModSection, modSectionsFor } from "@/lib/nav";

// A segmented-style pill on a `track`: the current section is a `surface` pill with ink text. The
// router adds `.active` and `aria-current="page"`. The outline sits inside the pill (negative
// offset) because the scrolling row would clip it outside.
const pill = `relative inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-[15px] font-semibold whitespace-nowrap text-soft outline-none hover:text-ink ${press} ${focusRing} focus-visible:-outline-offset-3 [&.active]:bg-surface [&.active]:text-ink`;

/**
 * Moderation sections. From `md` up: a segmented pill row that scrolls sideways when the sections
 * do not fit beside the rail. On a phone the sections do not fit a row either, so the current one
 * shows as a button that opens a sheet listing all of them with a plain line each. Nothing is
 * hidden off-screen and the current section is always named.
 */
export function ModNav({ role }: { role: "mod" | "admin" | undefined }) {
  const sections = modSectionsFor(role);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = activeModSection(pathname, sections);
  const [open, setOpen] = useState(false);
  const row = useRef<HTMLDivElement>(null);

  // Keep the current pill in view when the row scrolls. Only the row moves, never the page.
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const box = row.current;
    if (!el || !box) return;
    const left = el.offsetLeft; // `box` is the offset parent
    if (left < box.scrollLeft) box.scrollLeft = left - 4;
    else if (left + el.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollLeft = left + el.offsetWidth - box.clientWidth + 4;
    }
  }, [pathname]);

  return (
    <>
      <nav aria-label="Moderation" className="hidden md:block">
        <div
          ref={row}
          className="relative flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-track p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sections.map((s) => (
            <Link key={s.to} to={s.to} className={pill}>
              {s.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="flex items-center justify-between gap-3 md:hidden">
        <span className="text-soft">Moderation</span>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="outline" size="lg" className="min-w-32 justify-between" />}
          >
            <span>{current?.label ?? "Sections"}</span>
            <ChevronDownIcon aria-hidden="true" className="text-faint" />
          </SheetTrigger>
          <SheetContent side="bottom" className="data-[side=bottom]:gap-0">
            <SheetHeader>
              <SheetTitle>Moderation</SheetTitle>
              <SheetDescription className="sr-only">Pick a moderation section.</SheetDescription>
            </SheetHeader>
            <nav aria-label="Moderation sections">
              <ul className="divide-y divide-line">
                {sections.map((s) => {
                  const isCurrent = s === current;
                  return (
                    <li key={s.to}>
                      <Link
                        to={s.to}
                        onClick={() => setOpen(false)}
                        aria-current={isCurrent ? "page" : undefined}
                        className={cn(
                          "flex min-h-[60px] items-center gap-3 px-5 py-2.5 text-ink",
                          focusRing,
                          "focus-visible:-outline-offset-2",
                          isCurrent ? "bg-brand-soft" : "hover:bg-tint",
                        )}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span
                            className={cn("text-[15px]", isCurrent ? "font-bold" : "font-medium")}
                          >
                            {s.label}
                          </span>
                          <span className="text-[13px] leading-[1.3] text-soft">{s.hint}</span>
                        </span>
                        {isCurrent ? (
                          <CheckIcon
                            aria-hidden="true"
                            className="size-5 shrink-0 text-brand-ink"
                          />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
