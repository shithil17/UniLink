import * as React from "react";
import { ClockIcon } from "lucide-react";
import { cn } from "cn";
import { pickerTrigger } from "@/components/courses/OptionSelect";
import { Button } from "@/components/ui/button";
import { focusRingInset } from "@/components/ui/focus";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatClock } from "@/lib/routine";
import { minutesToTime, timeToMinutes } from "../../../shared/routine";

type TimeFieldProps = Omit<
  React.ComponentProps<"button">,
  "value" | "onChange" | "type" | "children" | "aria-label"
> & {
  /** "HH:MM", 24 hour, or an empty string for no time. The same string a native time input holds. */
  value: string;
  onChange: (value: string) => void;
  /** The field's name, said by screen readers with the time ("Starts, 9:40 AM"). */
  label: string;
  /** Adds a Clear action, for a field that may stay empty. */
  clearable?: boolean;
  /** What the button says while no time is picked. */
  placeholder?: string;
};

const PLACEHOLDER = "Pick a time";

/** The picker's steps: minutes are offered every five. */
// ceiling: five-minute steps cover class and ride times; a value already off the step (09:43) is
// listed too and kept. Revisit if a feature needs to pick single minutes.
const MINUTE_STEP = 5;

type Parts = { hour: number; minute: number; pm: boolean };

/** 24-hour "HH:MM" to the picker's 12-hour parts, or null when it is not a time. */
function partsOf(value: string): Parts | null {
  const total = timeToMinutes(value);
  if (total === null) return null;
  const h = Math.floor(total / 60);
  return { hour: h % 12 === 0 ? 12 : h % 12, minute: total % 60, pm: h >= 12 };
}

const valueOf = ({ hour, minute, pm }: Parts) =>
  minutesToTime(((hour % 12) + (pm ? 12 : 0)) * 60 + minute);

const STARTING_PARTS: Parts = { hour: 9, minute: 0, pm: false };

/**
 * A time field that reads the way students say times ("9:40 AM"), whatever the browser's locale: a
 * native time input follows the device's 12 or 24 hour setting and shows "--:-- --" when empty. It
 * is the same 48px button as `DateField`; tapping it opens a bottom sheet with hour, minute and
 * AM/PM lists, so opening it never moves the page. The value is the "HH:MM" string a time input holds.
 * The ref and aria attributes go to the button, which lets React Hook Form focus it on an error.
 */
export function TimeField({
  value,
  onChange,
  label,
  clearable,
  placeholder = PLACEHOLDER,
  className,
  ref,
  ...button
}: TimeFieldProps) {
  const [open, setOpen] = React.useState(false);
  const trigger = React.useRef<HTMLButtonElement | null>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const setRef = React.useCallback(
    (el: HTMLButtonElement | null) => {
      trigger.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  const current = partsOf(value);
  const done = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        {...button}
        ref={setRef}
        aria-label={`${label}, ${current ? formatClock(valueOf(current)) : placeholder}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          button.onClick?.(e);
          if (!e.defaultPrevented) setOpen(true);
        }}
        className={cn("relative", pickerTrigger, focusRingInset, className)}
      >
        <span className={cn("truncate tabular-nums", current ? "text-ink" : "text-faint")}>
          {current ? formatClock(valueOf(current)) : placeholder}
        </span>
        <ClockIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3.5 size-[18px] -translate-y-1/2 text-soft"
        />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          finalFocus={trigger}
          initialFocus={() =>
            panel.current?.querySelector<HTMLElement>("[role='option'][tabindex='0']") ?? true
          }
        >
          <SheetHeader className="pb-0">
            <SheetTitle>{PLACEHOLDER}</SheetTitle>
            <SheetDescription className="sr-only">
              Arrow keys change the hour, minute or AM and PM, Left and Right arrows move between
              them, Enter picks the time.
            </SheetDescription>
          </SheetHeader>
          <TimePanel
            panelRef={panel}
            current={current}
            clearable={clearable}
            onDone={(parts) => done(valueOf(parts))}
            onClear={() => done("")}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

type Item = { id: string; text: string };

const columnsOf = (panel: React.RefObject<HTMLDivElement | null>) =>
  Array.from(panel.current?.querySelectorAll<HTMLElement>("[role='listbox']") ?? []);

const HOURS: Item[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  text: String(i + 1),
}));
const PERIODS: Item[] = [
  { id: "AM", text: "AM" },
  { id: "PM", text: "PM" },
];

/** 00, 05, ... 55, plus the exact minute of a value that is off the step, in its place. */
function minuteItems(extra: number | undefined): Item[] {
  const minutes = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
  if (extra !== undefined && !minutes.includes(extra)) minutes.push(extra);
  return minutes
    .toSorted((a, b) => a - b)
    .map((m) => ({ id: String(m), text: String(m).padStart(2, "0") }));
}

/**
 * The three lists and the actions. The choice is a draft until Done, so scrolling through hours never
 * changes the form. Each list is a listbox whose selected option is the only one in the tab order;
 * the arrow keys change the choice, which follows focus.
 */
function TimePanel({
  panelRef,
  current,
  clearable,
  onDone,
  onClear,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  current: Parts | null;
  clearable?: boolean;
  onDone: (parts: Parts) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = React.useState<Parts>(current ?? STARTING_PARTS);
  // Kept from the saved value, so an off-step minute stays in the list after another is picked.
  const [minutes] = React.useState(() => minuteItems(current?.minute));
  // Set by a key press: the list whose selected option takes focus once the draft has rendered.
  const refocus = React.useRef<number | null>(null);

  const lists = [
    {
      name: "Hour",
      items: HOURS,
      selected: String(draft.hour),
      set: (id: string) => setDraft((d) => ({ ...d, hour: Number(id) })),
    },
    {
      name: "Minute",
      items: minutes,
      selected: String(draft.minute),
      set: (id: string) => setDraft((d) => ({ ...d, minute: Number(id) })),
    },
    {
      name: "AM or PM",
      items: PERIODS,
      selected: draft.pm ? "PM" : "AM",
      set: (id: string) => setDraft((d) => ({ ...d, pm: id === "PM" })),
    },
  ];

  // Open with each list scrolled so its selected option sits in the middle. Done before paint, and
  // on the list itself, so neither the sheet nor the page behind it moves.
  React.useLayoutEffect(() => {
    for (const list of columnsOf(panelRef)) {
      const option = list.querySelector<HTMLElement>("[aria-selected='true']");
      if (option) {
        list.scrollTop = option.offsetTop - (list.clientHeight - option.offsetHeight) / 2;
      }
    }
  }, [panelRef]);

  React.useEffect(() => {
    if (refocus.current === null) return;
    const option =
      columnsOf(panelRef)[refocus.current]?.querySelector<HTMLElement>("[aria-selected='true']");
    refocus.current = null;
    option?.focus();
    option?.scrollIntoView?.({ block: "nearest" });
  }, [draft, panelRef]);

  const onKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const { items, selected, set } = lists[index]!;
    const at = items.findIndex((i) => i.id === selected);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = Math.min(at + 1, items.length - 1);
    else if (e.key === "ArrowUp") next = Math.max(at - 1, 0);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const to = index + (e.key === "ArrowRight" ? 1 : -1);
      columnsOf(panelRef)[to]?.querySelector<HTMLElement>("[aria-selected='true']")?.focus();
      return;
    } else if (e.key === "Enter") {
      e.preventDefault();
      onDone(draft);
      return;
    } else return;
    e.preventDefault();
    refocus.current = index;
    set(items[next]!.id);
  };

  return (
    <>
      <div ref={panelRef} className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2 px-5">
        {lists.map((list, index) => (
          <div key={list.name} className="grid content-start gap-1">
            <span
              aria-hidden="true"
              className="text-center text-[13px] leading-7 font-semibold text-faint"
            >
              {index < 2 ? list.name : " "}
            </span>
            <div
              role="listbox"
              aria-label={list.name}
              onKeyDown={onKeyDown(index)}
              className={cn(
                "relative grid [scrollbar-width:none] content-start gap-0.5 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden",
                list.items.length > PERIODS.length && "h-55",
              )}
            >
              {list.items.map((item) => {
                const isSelected = item.id === list.selected;
                return (
                  <div
                    key={item.id}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => list.set(item.id)}
                    className={cn(
                      "grid h-11 shrink-0 cursor-pointer place-items-center rounded-full text-[15px] leading-none tabular-nums outline-none select-none focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-solid focus-visible:outline-brand",
                      isSelected
                        ? "bg-brand-soft font-bold text-brand-ink"
                        : "font-medium text-ink hover:bg-tint",
                    )}
                  >
                    {item.text}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <SheetFooter className="mt-0 flex-row gap-2 px-5 pt-0 pb-0">
        {clearable ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={!current}
            onClick={onClear}
          >
            Clear
          </Button>
        ) : null}
        <Button type="button" className="flex-1" onClick={() => onDone(draft)}>
          Done
        </Button>
      </SheetFooter>
    </>
  );
}
