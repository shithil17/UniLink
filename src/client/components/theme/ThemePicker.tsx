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

function Swatches({ theme }: { theme: ThemeMeta }) {
  return (
    <span className="flex shrink-0 -space-x-1.5" aria-hidden>
      {theme.swatches.map((color) => (
        <span
          key={color}
          className="size-5 rounded-full border border-line"
          style={{ backgroundColor: color }}
        />
      ))}
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
      className="gap-1.5"
    >
      {themes.map((t) => {
        const active = t.id === theme;
        return (
          <Radio.Root
            key={t.id}
            value={t.id}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "border-brand bg-tint" : "border-line bg-surface hover:bg-tint/60",
            )}
          >
            <Swatches theme={t} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                {t.name}
                {active && <CheckIcon className="size-3.5 shrink-0 text-brand" aria-hidden />}
              </span>
              <span className="block truncate text-[11px] text-soft">{t.blurb}</span>
            </span>
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
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition hover:bg-tint/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Swatches theme={current} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">{current.name}</span>
          <span className="block truncate text-[11px] text-soft">
            {current.blurb} · tap to change
          </span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-faint" aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[90dvh] overflow-y-auto rounded-t-3xl pb-6 md:max-w-lg"
        >
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
