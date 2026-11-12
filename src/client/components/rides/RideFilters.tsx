import { useQuery } from "@tanstack/react-query";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AreaPicker } from "@/components/areas/AreaPicker";
import { Button } from "@/components/ui/button";
import { Chip, chipClass } from "@/components/ui/chip";
import { DateField } from "@/components/ui/date-field";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { areaNameOf, areasQuery } from "@/lib/areas";
import { SEARCH_DEBOUNCE_MS } from "@/lib/useDebouncedValue";
import {
  dayLabel,
  VEHICLE_LABELS,
  VEHICLES,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  type RideFilters,
} from "@/lib/rides";
import { WEEKDAYS } from "../../../shared/rides";
import { RIDE_SEARCH_MAX_LENGTH } from "../../../shared/schemas/rides";

/** The sheet's fields: everything the Filters button holds. A weekday and a date are alternatives. */
type SheetFilters = Pick<RideFilters, "from" | "to" | "vehicle" | "day" | "date">;
const NO_SHEET_FILTERS: SheetFilters = {
  from: undefined,
  to: undefined,
  vehicle: undefined,
  day: undefined,
  date: undefined,
};
const sheetFiltersOf = (f: RideFilters): SheetFilters => ({
  from: f.from,
  to: f.to,
  vehicle: f.vehicle,
  day: f.day,
  date: f.date,
});
const sheetCount = (f: SheetFilters): number => Object.values(f).filter(Boolean).length;

const SHEET_ID = "ride-filter-sheet";

/**
 * The feed's filters, kept in the URL by the route: a text search over landmarks and area names, always
 * in view, and a Filters button that opens a bottom sheet for the From and To areas, vehicle, weekday
 * and date. The sheet is an overlay, so opening it never moves the page. Its choices are a draft that
 * "Show rides" applies. Each active filter shows as a chip that removes it, whether the sheet is open
 * or not. A weekday and a date are alternatives (a date already has a weekday), so picking one clears
 * the other. The text box keeps what is typed and sends it after a short pause; the route remounts the
 * bar (new `key`) when filters are cleared.
 */
export function RideFiltersBar({
  filters,
  onChange,
}: {
  filters: RideFilters;
  /** Merges these into the filters in the URL. */
  onChange: (patch: Partial<RideFilters>) => void;
}) {
  // The button counts what its sheet holds; the search box is always in view and is not counted.
  const count = sheetCount(sheetFiltersOf(filters));
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Names for the area chips; the pickers share this query, so it is one request.
  const areas = useQuery({ ...areasQuery, enabled: Boolean(filters.from || filters.to) });
  const areaLabel = (prefix: string, id: number) =>
    `${prefix} ${areaNameOf(areas.data, id) ?? "an area"}`;
  const chips: { key: string; label: string; clear: Partial<RideFilters> }[] = [
    ...(filters.from
      ? [{ key: "from", label: areaLabel("From", filters.from), clear: { from: undefined } }]
      : []),
    ...(filters.to
      ? [{ key: "to", label: areaLabel("To", filters.to), clear: { to: undefined } }]
      : []),
    ...(filters.vehicle
      ? [{ key: "vehicle", label: VEHICLE_LABELS[filters.vehicle], clear: { vehicle: undefined } }]
      : []),
    ...(filters.day
      ? [{ key: "day", label: WEEKDAY_LONG[filters.day], clear: { day: undefined } }]
      : []),
    ...(filters.date
      ? [{ key: "date", label: dayLabel(filters.date), clear: { date: undefined } }]
      : []),
  ];

  const typed = (value: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => onChange({ q: value.trim() || undefined }),
      SEARCH_DEBOUNCE_MS,
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            aria-hidden
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-faint"
          />
          <Input
            type="search"
            aria-label="Search landmark or area"
            placeholder="Search landmark or area"
            maxLength={RIDE_SEARCH_MAX_LENGTH}
            autoComplete="off"
            className="pl-10"
            defaultValue={filters.q ?? ""}
            onChange={(e) => typed(e.target.value)}
          />
        </div>
        <Button
          ref={button}
          type="button"
          variant="outline"
          className="shrink-0"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? SHEET_ID : undefined}
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontalIcon aria-hidden strokeWidth={1.75} />
          Filters
          {/* Always there, one digit wide, so the first filter never widens the button. */}
          <span className="inline-block w-[1ch] text-center tabular-nums">
            {count > 0 ? count : ""}
          </span>
        </Button>
      </div>

      {chips.length > 0 ? (
        <ul aria-label="Active filters" className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                aria-label={`Remove filter: ${c.label}`}
                className={`${chipClass} bg-brand-soft pr-3 text-brand-ink`}
                onClick={() => onChange(c.clear)}
              >
                {c.label}
                <XIcon aria-hidden className="size-4 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          id={SHEET_ID}
          finalFocus={button}
          className="data-[side=bottom]:gap-3 data-[side=bottom]:overflow-hidden data-[side=bottom]:pb-0"
        >
          <FilterSheetBody
            filters={filters}
            onApply={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** The sheet's contents. Mounted when the sheet opens, so the draft starts from the URL's filters. */
function FilterSheetBody({
  filters,
  onApply,
}: {
  filters: RideFilters;
  onApply: (next: SheetFilters) => void;
}) {
  const [draft, setDraft] = useState<SheetFilters>(() => sheetFiltersOf(filters));
  const change = (patch: Partial<SheetFilters>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <>
      <SheetHeader className="pb-0">
        <SheetTitle>Filters</SheetTitle>
        <SheetDescription className="sr-only">
          Narrow the rides by area, vehicle and day, then show the rides.
        </SheetDescription>
      </SheetHeader>
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain px-5 pb-2">
        <Field>
          <FieldLabel htmlFor="ride-filter-from">From</FieldLabel>
          <AreaPicker
            id="ride-filter-from"
            title="Rides from"
            anyLabel="Any area"
            value={draft.from ?? null}
            onChange={(next) => change({ from: next ?? undefined })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ride-filter-to">To</FieldLabel>
          <AreaPicker
            id="ride-filter-to"
            title="Rides to"
            anyLabel="Any area"
            value={draft.to ?? null}
            onChange={(next) => change({ to: next ?? undefined })}
          />
          <FieldDescription>Pick a whole area to include its sub-areas too.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel id="ride-filter-vehicle">Vehicle</FieldLabel>
          <div role="group" aria-labelledby="ride-filter-vehicle" className="flex flex-wrap gap-2">
            {VEHICLES.map((v) => (
              <Chip
                key={v}
                pressed={draft.vehicle === v}
                onPressedChange={(on) => change({ vehicle: on ? v : undefined })}
              >
                {VEHICLE_LABELS[v]}
              </Chip>
            ))}
          </div>
        </Field>
        <Field>
          <FieldLabel id="ride-filter-day">Weekday</FieldLabel>
          <div role="group" aria-labelledby="ride-filter-day" className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <Chip
                key={d}
                pressed={draft.day === d}
                aria-label={WEEKDAY_LONG[d]}
                onPressedChange={(on) => change({ day: on ? d : undefined, date: undefined })}
              >
                {WEEKDAY_SHORT[d]}
              </Chip>
            ))}
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="ride-filter-date">Or a date</FieldLabel>
          <DateField
            id="ride-filter-date"
            label="Or a date"
            clearable
            value={draft.date ?? ""}
            onChange={(date) => change({ date: date || undefined, day: undefined })}
          />
        </Field>
      </div>
      <SheetFooter className="mt-0 shrink-0 flex-row gap-2 pb-[max(1.375rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={sheetCount(draft) === 0}
          onClick={() => setDraft(NO_SHEET_FILTERS)}
        >
          Clear
        </Button>
        <Button type="button" className="flex-1" onClick={() => onApply(draft)}>
          Show rides
        </Button>
      </SheetFooter>
    </>
  );
}
