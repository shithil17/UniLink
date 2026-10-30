import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { resolveTheme } from "../../../shared/themes";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Swatch, ThemePicker } from "./ThemePicker";
import { useTheme } from "./themeContext";

/**
 * One settings row showing the current palette; it opens a bottom sheet with the full picker. The
 * sheet stays open while a palette is chosen so they can be compared live, and closes like any other.
 */
export function ThemeRow({ className }: { className?: string }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const current = resolveTheme(theme);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(className, focusRing, press)}
      >
        <Swatch theme={current} />
        <span className="flex-1">Theme</span>
        <span className="text-soft">{current.name}</span>
        <ChevronRightIcon className="size-5 shrink-0 text-faint" aria-hidden="true" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Theme</SheetTitle>
          </SheetHeader>
          <ThemePicker inSheet />
        </SheetContent>
      </Sheet>
    </>
  );
}
