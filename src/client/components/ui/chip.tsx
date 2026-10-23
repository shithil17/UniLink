import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import { focusRing } from "./focus";
import { press } from "./press";

/** The chip's look, exported for plain buttons that act as chips (a jump list) and are not toggles. */
export const chipClass = `relative inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-surface px-4 text-sm leading-none font-medium whitespace-nowrap text-ink outline-none select-none after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[''] ${press} ${focusRing} hover:bg-brand-soft disabled:pointer-events-none disabled:bg-line disabled:text-faint aria-pressed:bg-brand-soft aria-pressed:text-brand-ink`;

type ChipProps = Omit<React.ComponentProps<"button">, "aria-pressed"> & {
  /** Controlled pressed state. Leave it out and the chip keeps its own. */
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
};

/**
 * A toggle for filters and jump lists. `aria-pressed` carries the state; a pressed chip also shows
 * a check, so the state is never color alone. 40px tall with the touch area reaching 44px.
 */
function Chip({
  className,
  pressed: pressedProp,
  defaultPressed = false,
  onPressedChange,
  onClick,
  children,
  ...props
}: ChipProps) {
  const [inner, setInner] = React.useState(defaultPressed);
  const pressed = pressedProp ?? inner;

  return (
    <button
      type="button"
      data-slot="chip"
      aria-pressed={pressed}
      className={cn(chipClass, className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (pressedProp === undefined) setInner(!pressed);
        onPressedChange?.(!pressed);
      }}
      {...props}
    >
      {pressed ? (
        <CheckIcon aria-hidden data-slot="chip-check" className="size-4 shrink-0" />
      ) : null}
      {children}
    </button>
  );
}

export { Chip };
