import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import { resolveTheme, themes, type ThemeMeta } from "../../../shared/themes";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@/components/ui/radio-group";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { useTheme } from "./themeContext";

/**
 * A palette's accent as a 28px dot (Night shows its ink instead). Colors come from the registry,
 * not from tokens, because the swatch must keep showing its own palette whichever one is active.
 */
export function Swatch({ theme }: { theme: ThemeMeta }) {
  return (
    <span
      className="size-7 shrink-0 rounded-full"
      style={{ backgroundColor: theme.id === "night" ? theme.ink : theme.accent }}
      aria-hidden
    />
  );
}

/**
 * All palettes as a radio group inside a flat panel: arrow keys move the choice, Tab enters and
 * leaves the group. The chosen row carries a check, so selection is never color alone.
 */
export function ThemePicker({ inSheet = false }: { inSheet?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <RadioGroup
      aria-label="Color theme"
      value={theme}
      onValueChange={(id) => {
        setTheme(resolveTheme(id).id);
      }}
      // In a sheet the rows sit on the sheet's own surface, so no second panel behind them.
      className={cn(
        "gap-0",
        !inSheet && "overflow-hidden rounded-panel bg-surface md:rounded-[24px]",
      )}
    >
      {themes.map((t) => {
        const active = t.id === theme;
        return (
          <Radio.Root
            key={t.id}
            value={t.id}
            className={cn(
              "flex min-h-14 w-full cursor-pointer items-center gap-3 border-t border-line py-2 text-left outline-none first:border-t-0 hover:bg-tint active:bg-tint",
              inSheet ? "px-5" : "px-4",
              focusRing,
              "focus-visible:-outline-offset-2",
              press,
            )}
          >
            <Swatch theme={t} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] leading-[1.2] font-medium text-ink">{t.name}</span>
              <span className="mt-0.5 block truncate text-[13px] leading-[1.3] text-faint">
                {t.blurb}
              </span>
            </span>
            {active ? <CheckIcon className="size-5 shrink-0 text-brand-ink" aria-hidden /> : null}
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}
