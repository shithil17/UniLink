import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { resolveTheme, themes, type ThemeMeta } from "../../../shared/themes";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTheme } from "./themeContext";

/**
 * A palette's ground, ink and accent. Colors come from the registry, not from tokens, because the
 * preview must keep showing its own palette whichever one is active.
 */
function Preview({ theme }: { theme: ThemeMeta }) {
  return (
    <span
      className="flex h-9 w-14 shrink-0 items-center justify-between rounded-md border border-line px-2"
      style={{ backgroundColor: theme.bar }}
      aria-hidden
    >
      <span className="text-sm leading-none font-semibold" style={{ color: theme.ink }}>
        Aa
      </span>
      <span className="size-3 rounded-full" style={{ backgroundColor: theme.accent }} />
    </span>
  );
}

/** All palettes as a radio group: arrow keys move the choice, Tab enters and leaves the group. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <RadioGroup
      aria-label="Color theme"
      value={theme}
      onValueChange={(id) => {
        setTheme(resolveTheme(id).id);
      }}
      className="gap-0 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface"
    >
      {themes.map((t) => {
        const active = t.id === theme;
        return (
          <Radio.Root
            key={t.id}
            value={t.id}
            className={cn(
              "flex min-h-14 w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset",
              active ? "bg-brand-soft" : "hover:bg-tint",
            )}
          >
            <Preview theme={t} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{t.name}</span>
              <span className="block truncate text-xs text-soft">{t.blurb}</span>
            </span>
            {active && <CheckIcon className="size-4 shrink-0 text-brand" aria-hidden />}
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}

/** Shows the current palette and opens the sheet with every palette. */
export function ThemePickerTrigger() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const current = resolveTheme(theme);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-edge bg-surface px-3 py-2 text-left transition-colors hover:bg-tint focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <Preview theme={current} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{current.name}</span>
          <span className="block truncate text-xs text-soft">{current.blurb}</span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-faint" aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Choose theme</SheetTitle>
            <SheetDescription>Colors only. Your choice is saved on this device.</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <ThemePicker />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
