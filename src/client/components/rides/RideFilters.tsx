import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SEARCH_DEBOUNCE_MS } from "@/lib/useDebouncedValue";
import {
  activeFilterCount,
  VEHICLE_LABELS,
  VEHICLES,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  type RideFilters,
} from "@/lib/rides";
import { WEEKDAYS } from "../../../shared/rides";
import { RIDE_SEARCH_MAX_LENGTH } from "../../../shared/schemas/rides";

/**
 * The feed's filters, kept in the URL by the route: a text search over pickup and destination, always
 * in view, and a Filters panel for vehicle, weekday and date. A weekday and a date are alternatives
 * (a date already has a weekday), so picking one clears the other. The text box keeps what is typed
 * and sends it after a short pause; the route remounts the bar (new `key`) when filters are cleared.
 */
export function RideFiltersBar({
  filters,
  onChange,
  onClear,
}: {
  filters: RideFilters;
  /** Merges these into the filters in the URL. */
  onChange: (patch: Partial<RideFilters>) => void;
  onClear: () => void;
}) {
  const count = activeFilterCount(filters);
  const [open, setOpen] = useState(() => count - (filters.q ? 1 : 0) > 0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

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
            aria-label="Search pickup or destination"
            placeholder="Search pickup or destination"
            maxLength={RIDE_SEARCH_MAX_LENGTH}
            autoComplete="off"
            className="pl-10"
            defaultValue={filters.q ?? ""}
            onChange={(e) => typed(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          aria-controls="ride-filter-panel"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontalIcon aria-hidden strokeWidth={1.75} />
          Filters
          {count > 0 ? <span className="tabular-nums">{count}</span> : null}
        </Button>
      </div>

      {open ? (
        <div id="ride-filter-panel" className="grid gap-4 rounded-panel bg-surface p-4">
          <Field>
            <FieldLabel id="ride-filter-vehicle">Vehicle</FieldLabel>
            <div
              role="group"
              aria-labelledby="ride-filter-vehicle"
              className="flex flex-wrap gap-2"
            >
              {VEHICLES.map((v) => (
                <Chip
                  key={v}
                  pressed={filters.vehicle === v}
                  onPressedChange={(on) => onChange({ vehicle: on ? v : undefined })}
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
                  pressed={filters.day === d}
                  aria-label={WEEKDAY_LONG[d]}
                  onPressedChange={(on) => onChange({ day: on ? d : undefined, date: undefined })}
                >
                  {WEEKDAY_SHORT[d]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="ride-filter-date">Or a date</FieldLabel>
            <Input
              id="ride-filter-date"
              type="date"
              value={filters.date ?? ""}
              onChange={(e) => onChange({ date: e.target.value || undefined, day: undefined })}
            />
          </Field>
          {count > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start"
              onClick={onClear}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
