import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { pickerTrigger } from "@/components/courses/OptionSelect";
import { ErrorBlock } from "@/components/ui/error-block";
import { focusRingInset } from "@/components/ui/focus";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { errorMessage } from "@/lib/api";
import { areaNameOf, areaRows, areasQuery, type AreaRow } from "@/lib/areas";
import type { AreaOption } from "../../../shared/schemas/areas";

const rowClass =
  "flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-tint";

/**
 * Picks one area from the Dhaka list, top-level areas with their sub-areas indented under them. A
 * top-level area and a sub-area can both be picked. The list is fetched when the sheet first opens, or
 * on mount when `value` is set and its name is not otherwise known (an area in the URL).
 *
 * `current` names the saved choice, which may be an area hidden from the list since. With
 * `anyLabel` the picker is clearable: the first row clears the choice and the trigger reads `anyLabel`
 * when there is none (the feed filter). Without it a value is always required (the ride form).
 */
export function AreaPicker({
  id,
  value,
  onChange,
  current,
  title = "Pick an area",
  placeholder = "Pick an area",
  anyLabel,
  invalid,
}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  current?: { id: number; name: string } | null;
  /** The sheet's heading. */
  title?: string;
  /** The trigger's text while nothing is picked and the picker is not clearable. */
  placeholder?: string;
  /** Makes the picker clearable; the text for "no area". */
  anyLabel?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);

  const known =
    value === null ? null : picked?.id === value ? picked : current?.id === value ? current : null;
  const list = useQuery({ ...areasQuery, enabled: open || (value !== null && known === null) });
  const name = known?.name ?? (value === null ? undefined : areaNameOf(list.data, value));
  const label = value === null ? (anyLabel ?? placeholder) : (name ?? "Chosen area");

  return (
    <>
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen(true)}
        className={`relative ${pickerTrigger} ${focusRingInset}`}
      >
        <span className={`truncate ${value === null && !anyLabel ? "text-faint" : "text-ink"}`}>
          {label}
        </span>
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
              Search the areas, then pick one. Sub-areas are listed under their area.
            </SheetDescription>
          </SheetHeader>
          <PickerBody
            value={value}
            anyLabel={anyLabel}
            list={list}
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
  anyLabel,
  list,
  onPick,
}: {
  value: number | null;
  anyLabel?: string;
  list: UseQueryResult<AreaOption[]>;
  onPick: (value: { id: number; name: string } | null) => void;
}) {
  const base = useId();
  const listboxId = `${base}-list`;
  const [query, setQuery] = useState("");
  // Set once the arrow keys move the highlight; typing puts it back on the first match.
  const [moved, setMoved] = useState<number | null>(null);
  const rows: AreaRow[] = list.data ? areaRows(list.data, query) : [];

  // With a clearable picker, row 0 is the "any" row and the areas follow.
  const offset = anyLabel ? 1 : 0;
  const count = rows.length + offset;
  const active = Math.min(
    moved ?? (query.trim() !== "" && rows.length > 0 ? offset : 0),
    count - 1,
  );
  const optionId = (n: number) => `${base}-opt-${n}`;
  const pick = (n: number) => {
    if (n < offset) onPick(null);
    else {
      const row = rows[n - offset];
      if (row) onPick({ id: row.id, name: row.name });
    }
  };

  const activeId = optionId(active);
  useEffect(() => {
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMoved(Math.min(active + 1, count - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMoved(Math.max(active - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (count > 0) pick(active);
    }
  };

  return (
    <>
      <div className="px-5">
        <div className="relative">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-faint"
          />
          <Input
            type="search"
            className="pl-10"
            placeholder="Search areas"
            aria-label="Search areas"
            autoComplete="off"
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
      </div>
      <p role="status" className="sr-only">
        {list.isPending ? "Loading areas" : `${rows.length} found`}
      </p>
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Areas"
        className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain border-t border-line pb-[env(safe-area-inset-bottom)]"
      >
        {anyLabel ? (
          <li
            id={optionId(0)}
            role="option"
            aria-selected={value === null}
            onClick={() => pick(0)}
            className={`${rowClass} ${value === null ? "bg-brand-soft" : active === 0 ? "bg-tint" : ""}`}
          >
            <span className="flex-1 font-medium text-ink">{anyLabel}</span>
            {value === null ? <Check /> : null}
          </li>
        ) : null}
        {rows.map((r, i) => {
          const n = i + offset;
          const sub = r.parentName !== null;
          return (
            <li
              key={r.id}
              id={optionId(n)}
              role="option"
              aria-selected={r.id === value}
              aria-label={sub ? `${r.name}, in ${r.parentName}` : undefined}
              onClick={() => pick(n)}
              className={`${rowClass} ${sub ? "pl-9" : ""} ${r.id === value ? "bg-brand-soft" : active === n ? "bg-tint" : ""}`}
            >
              <span className={`flex-1 ${sub ? "text-soft" : "font-medium text-ink"}`}>
                {r.name}
              </span>
              {r.id === value ? <Check /> : null}
            </li>
          );
        })}
        {list.isPending ? (
          <li role="presentation" className="px-4 py-8 text-center text-[15px] text-soft">
            Loading areas
          </li>
        ) : list.isError ? (
          <li role="presentation" className="p-4">
            <ErrorBlock
              title="The areas didn't load"
              message={errorMessage(list.error)}
              onRetry={() => void list.refetch()}
              retrying={list.isRefetching}
            />
          </li>
        ) : rows.length === 0 ? (
          <li role="presentation" className="px-4 py-8 text-center text-[15px] text-soft">
            No area matches that. Try a shorter name.
          </li>
        ) : null}
      </ul>
    </>
  );
}

const Check = () => <CheckIcon aria-hidden="true" className="size-5 shrink-0 text-brand-ink" />;
