import { useInfiniteQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { FacultyFilters } from "@/components/faculty/FacultyFilters";
import { FacultyRowText } from "@/components/faculty/FacultyRowText";
import { Button } from "@/components/ui/button";
import { ErrorBlock } from "@/components/ui/error-block";
import { focusRingInset } from "@/components/ui/focus";
import { pickerTrigger } from "./OptionSelect";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { errorMessage } from "@/lib/api";
import { facultyOptionsList } from "@/lib/faculty";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { FacultyOption } from "../../../shared/schemas/faculty";
import { facultyTitle } from "../../../shared/facultySearch";

const rowClass =
  "flex min-h-15 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-tint";

/**
 * The faculty member who taught the course, or none. Optional everywhere it is used. The list is
 * searched on the server a page at a time, only once the sheet opens, so a failed load never blocks
 * saving. `current` names the saved choice, which may be a faculty member hidden from the list since;
 * a choice made in this sheet is remembered here for the label.
 */
export function FacultyPicker({
  id,
  value,
  onChange,
  current,
}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  current?: { name: string; initials: string | null } | null;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<FacultyOption | null>(null);

  const selected = value === null ? null : picked?.id === value ? picked : (current ?? null);
  const label =
    value === null ? "No faculty" : selected ? facultyTitle(selected) : "Chosen faculty";

  return (
    <>
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`relative ${pickerTrigger} ${focusRingInset}`}
      >
        <span className="truncate text-ink">{label}</span>
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
            <SheetTitle>Who taught it?</SheetTitle>
            <SheetDescription className="sr-only">
              Search the faculty list, then pick one, or choose no faculty.
            </SheetDescription>
          </SheetHeader>
          <PickerBody
            value={value}
            onPick={(next) => {
              setPicked(next);
              onChange(next?.id ?? null);
              setOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

function PickerBody({
  value,
  onPick,
}: {
  value: number | null;
  onPick: (value: FacultyOption | null) => void;
}) {
  const base = useId();
  const listboxId = `${base}-list`;
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  // Set once the arrow keys move the highlight; typing or filtering puts it back on the first match.
  const [moved, setMoved] = useState<number | null>(null);
  // The server searches every faculty member; a new term or department starts again at page one.
  const search = useDebouncedValue(query);
  const list = useInfiniteQuery(facultyOptionsList({ q: search, department }));
  const results = list.data?.pages.flatMap((p) => p.items) ?? [];

  // False while typing and while the last term's rows are still on screen: Enter must not pick those.
  const settled = query.trim() === search.trim() && !list.isPlaceholderData;

  // Row 0 is "No faculty"; the results follow.
  const rows = results.length + 1;
  const active = moved ?? (settled && query.trim() !== "" && results.length > 0 ? 1 : 0);
  const optionId = (n: number) => `${base}-opt-${n}`;
  const pick = (n: number) => onPick(n === 0 ? null : (results[n - 1] ?? null));

  const activeId = optionId(active);
  useEffect(() => {
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMoved(Math.min(active + 1, rows - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMoved(Math.max(active - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (settled) pick(active);
    }
  };

  return (
    <>
      <div className="px-5">
        <FacultyFilters
          idPrefix={base}
          query={query}
          onQuery={(v) => {
            setQuery(v);
            setMoved(null);
          }}
          department={department}
          onDepartment={(v) => {
            setDepartment(v);
            setMoved(null);
          }}
          onKeyDown={onKeyDown}
          listboxId={listboxId}
          activeId={activeId}
          autoFocus
        />
      </div>
      <p role="status" className="sr-only">
        {list.isPending
          ? "Loading faculty"
          : `${results.length} found${list.hasNextPage ? ", more available" : ""}`}
      </p>
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Faculty"
        aria-busy={list.isPending || list.isPlaceholderData}
        className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain border-t border-line pb-[env(safe-area-inset-bottom)]"
      >
        <li
          id={optionId(0)}
          role="option"
          aria-selected={value === null}
          onClick={() => pick(0)}
          className={`${rowClass} ${value === null ? "bg-brand-soft" : active === 0 ? "bg-tint" : ""}`}
        >
          <span className="flex-1 font-medium text-ink">No faculty</span>
          {value === null ? (
            <CheckIcon aria-hidden="true" className="size-5 shrink-0 text-brand-ink" />
          ) : null}
        </li>
        {results.map((f, i) => (
          <li
            key={f.id}
            id={optionId(i + 1)}
            role="option"
            aria-selected={f.id === value}
            onClick={() => pick(i + 1)}
            className={`${rowClass} ${f.id === value ? "bg-brand-soft" : active === i + 1 ? "bg-tint" : ""}`}
          >
            <FacultyRowText faculty={f} />
            {f.id === value ? (
              <CheckIcon aria-hidden="true" className="size-5 shrink-0 text-brand-ink" />
            ) : null}
          </li>
        ))}
        {list.isPending ? (
          <li role="presentation" className="px-4 py-8 text-center text-[15px] text-soft">
            Loading faculty
          </li>
        ) : list.isError ? (
          <li role="presentation" className="p-4">
            <ErrorBlock
              title="The faculty list didn't load"
              message={`${errorMessage(list.error)} You can save without it.`}
              onRetry={() => void list.refetch()}
              retrying={list.isRefetching}
            />
          </li>
        ) : results.length === 0 ? (
          <li role="presentation" className="px-4 py-8 text-center text-[15px] text-soft">
            No faculty match that search.
          </li>
        ) : null}
        {list.hasNextPage ? (
          <li role="presentation" className="p-4">
            <Button
              variant="outline"
              className="w-full"
              loading={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Show more
            </Button>
          </li>
        ) : null}
      </ul>
    </>
  );
}
