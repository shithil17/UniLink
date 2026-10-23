import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { StateMark } from "@/components/courses/StateMark";
import { focusRingInset } from "@/components/ui/focus";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { searchCourses, type CourseChoice } from "@/lib/courseSearch";
import { cn } from "@/lib/utils";
import { CourseCode } from "./CourseCode";
import { pickerTrigger } from "./OptionSelect";

const rowClass =
  "flex min-h-15 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-tint";

/**
 * A course field that opens a searchable list in a bottom sheet, for lists too long to scroll:
 * search by code ("cse225", "cse 2") or by title words ("data struct"). Courses the student can take
 * now come first, each with its state mark.
 */
export function CoursePicker({
  id,
  value,
  onChange,
  choices,
  placeholder = "Pick a course",
  title = "Pick the course",
  invalid,
  disabled,
}: {
  id: string;
  value: string | null;
  onChange: (code: string) => void;
  choices: readonly CourseChoice[];
  placeholder?: string;
  /** The sheet's heading. */
  title?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = choices.find((c) => c.code === value);

  return (
    <>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen(true)}
        className={cn("relative", pickerTrigger, focusRingInset)}
      >
        {value ? (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 font-medium text-ink">{value}</span>
            {selected?.title ? <span className="truncate text-soft">{selected.title}</span> : null}
          </span>
        ) : (
          <span className="text-faint">{placeholder}</span>
        )}
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3.5 size-[18px] -translate-y-1/2 text-soft"
        />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="data-[side=bottom]:h-[85dvh] data-[side=bottom]:gap-3 data-[side=bottom]:overflow-hidden data-[side=bottom]:pb-0"
        >
          <SheetHeader className="pb-0">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="sr-only">
              Search by course code or title, then pick one.
            </SheetDescription>
          </SheetHeader>
          <PickerBody
            choices={choices}
            value={value}
            onPick={(code) => {
              onChange(code);
              setOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

function PickerBody({
  choices,
  value,
  onPick,
}: {
  choices: readonly CourseChoice[];
  value: string | null;
  onPick: (code: string) => void;
}) {
  const base = useId();
  const listboxId = `${base}-list`;
  const [query, setQuery] = useState("");
  // Set once the arrow keys move the highlight; typing puts it back on the first match.
  const [moved, setMoved] = useState<number | null>(null);
  const results = useMemo(() => searchCourses(choices, query), [choices, query]);
  const active = moved ?? 0;
  const optionId = (n: number) => `${base}-opt-${n}`;
  const activeId = results.length > 0 ? optionId(active) : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMoved(Math.min(active + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMoved(Math.max(active - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[active];
      if (hit) onPick(hit.code);
    }
  };

  return (
    <>
      <div className="relative px-5">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-8 size-[18px] -translate-y-1/2 text-faint"
        />
        <Input
          type="search"
          className="pl-10"
          placeholder="Search by code or title"
          aria-label="Search by code or title"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMoved(null);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
        />
      </div>
      <p role="status" className="sr-only">
        {results.length} found
      </p>
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Courses"
        className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain border-t border-line pb-[env(safe-area-inset-bottom)]"
      >
        {results.map((c, i) => {
          const chosen = c.code === value;
          return (
            <li
              key={c.code}
              id={optionId(i)}
              role="option"
              aria-selected={chosen}
              onClick={() => onPick(c.code)}
              className={cn(rowClass, chosen ? "bg-brand-soft" : i === active && "bg-tint")}
            >
              {c.status ? <StateMark status={c.status} waived={c.waived} /> : null}
              <span className="flex min-w-[4.75rem] shrink-0">
                <CourseCode code={c.code} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{c.title}</span>
              {chosen ? (
                <CheckIcon aria-hidden="true" className="size-5 shrink-0 text-brand-ink" />
              ) : null}
            </li>
          );
        })}
        {results.length === 0 ? (
          <li className="px-4 py-8 text-center text-[15px] text-soft">
            No course matches that search.
          </li>
        ) : null}
      </ul>
    </>
  );
}
