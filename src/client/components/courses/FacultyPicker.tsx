import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { FacultyFilters } from "@/components/faculty/FacultyFilters";
import { FacultyRowText } from "@/components/faculty/FacultyRowText";
import { focusRingInset } from "@/components/ui/focus";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { facultyQuery } from "@/lib/queries";
import { toast } from "@/lib/toast";
import type { FacultyOption } from "../../../shared/schemas/faculty";
import { facultyTitle, searchFaculty } from "../../../shared/facultySearch";

const rowClass = `flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left transition-colors`;

/**
 * The faculty member who taught the course, or none. Optional everywhere it is used, so a list that
 * fails to load never blocks saving: the control is disabled and a toast says why. `current` names the
 * saved choice, which may be a faculty member hidden from the list since.
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
  const { data, isError } = useQuery(facultyQuery);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (isError) {
      toast.error("The faculty list did not load. You can save without it.", {
        id: "faculty-load",
      });
    }
  }, [isError]);

  const selected = value === null ? null : (data?.find((f) => f.id === value) ?? current ?? null);
  const label =
    value === null ? "No faculty" : selected ? facultyTitle(selected) : "Chosen faculty";

  return (
    <>
      <button
        type="button"
        id={id}
        disabled={!data}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`flex h-11 w-full items-center justify-between gap-1.5 rounded-control border border-input bg-surface py-2 pr-2 pl-3 text-left text-sm transition-colors outline-none ${focusRingInset} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className="truncate text-ink">{label}</span>
        <ChevronsUpDownIcon aria-hidden="true" className="size-4 shrink-0 text-faint" />
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
            list={data ?? []}
            value={value}
            onPick={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

function PickerBody({
  list,
  value,
  onPick,
}: {
  list: readonly FacultyOption[];
  value: number | null;
  onPick: (value: number | null) => void;
}) {
  const base = useId();
  const listboxId = `${base}-list`;
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  // Set once the arrow keys move the highlight; typing or filtering puts it back on the first match.
  const [moved, setMoved] = useState<number | null>(null);
  const results = useMemo(
    () => searchFaculty(list, { query, department }),
    [list, query, department],
  );

  // Row 0 is "No faculty"; the results follow.
  const rows = results.length + 1;
  const active = moved ?? (query.trim() !== "" && results.length > 0 ? 1 : 0);
  const optionId = (n: number) => `${base}-opt-${n}`;
  const pick = (n: number) => onPick(n === 0 ? null : (results[n - 1]?.id ?? null));

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
      pick(active);
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
        {results.length} found
      </p>
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Faculty"
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
          {value === null ? <CheckIcon aria-hidden="true" className="size-4 text-ink" /> : null}
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
            {f.id === value ? <CheckIcon aria-hidden="true" className="size-4 text-ink" /> : null}
          </li>
        ))}
        {results.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-soft">No faculty match that search.</li>
        ) : null}
      </ul>
    </>
  );
}
