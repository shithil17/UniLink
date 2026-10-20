import { Link, useRouterState } from "@tanstack/react-router";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { focusRing } from "@/components/ui/focus";
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

const tab = `relative inline-flex h-9 shrink-0 items-center rounded-control px-3 text-sm font-medium whitespace-nowrap text-soft transition-colors hover:text-ink ${focusRing} after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 [&.active]:text-ink [&.active]:after:bg-ink`;

/**
 * Moderation sections. From `md` up: an underline tab row. On a phone the seven sections do not fit
 * a row, so the current one shows as a button that opens a sheet listing all of them with a plain
 * line each. Nothing is hidden off-screen and the current section is always named.
 */
export function ModNav({ role }: { role: "mod" | "admin" | undefined }) {
  const sections = modSectionsFor(role);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = activeModSection(pathname, sections);
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav aria-label="Moderation" className="hidden md:block">
        <div className="flex gap-1 border-b border-line">
          {sections.map((s) => (
            <Link key={s.to} to={s.to} className={tab}>
              {s.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="flex items-center justify-between gap-3 border-b border-line pb-3 md:hidden">
        <span className="text-sm text-soft">Moderation</span>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="outline" size="lg" className="min-w-32 justify-between" />}
          >
            <span className="font-semibold">{current?.label ?? "Sections"}</span>
            <ChevronDownIcon aria-hidden="true" className="text-faint" />
          </SheetTrigger>
          <SheetContent side="bottom" className="data-[side=bottom]:gap-0">
            <SheetHeader>
              <SheetTitle>Moderation</SheetTitle>
              <SheetDescription className="sr-only">Pick a moderation section.</SheetDescription>
            </SheetHeader>
            <nav aria-label="Moderation sections">
              <ul className="divide-y divide-line border-y border-line">
                {sections.map((s) => {
                  const isCurrent = s === current;
                  return (
                    <li key={s.to}>
                      <Link
                        to={s.to}
                        onClick={() => setOpen(false)}
                        aria-current={isCurrent ? "page" : undefined}
                        className={`flex min-h-14 items-center gap-3 px-4 py-2 text-ink ${focusRing} focus-visible:-outline-offset-2 ${isCurrent ? "bg-brand-soft" : "hover:bg-tint"}`}
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className={isCurrent ? "font-semibold" : "font-medium"}>
                            {s.label}
                          </span>
                          <span className="text-sm text-soft">{s.hint}</span>
                        </span>
                        {isCurrent ? (
                          <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-brand" />
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
