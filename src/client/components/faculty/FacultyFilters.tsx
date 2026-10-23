import { SearchIcon } from "lucide-react";
import { OptionSelect } from "@/components/courses/OptionSelect";
import { Input } from "@/components/ui/input";
import { DEPARTMENTS } from "../../../shared/departments";

export const ALL_DEPARTMENTS = "all";

const departmentChoices = [
  { value: ALL_DEPARTMENTS, label: "All departments" },
  ...DEPARTMENTS.map((d) => ({ value: d.code, label: `${d.code} · ${d.name}` })),
];

/**
 * The search box and department filter shared by the student picker and the moderator list.
 *
 * ceiling: the department filter stays a select. There are 18 departments, which as chips would be
 * a wall of wrapped pills on a phone; revisit if the list shrinks to a handful of schools.
 */
export function FacultyFilters({
  idPrefix,
  query,
  onQuery,
  department,
  onDepartment,
  onKeyDown,
  listboxId,
  activeId,
  autoFocus,
}: {
  idPrefix: string;
  query: string;
  onQuery: (value: string) => void;
  /** A department code, or null for all. */
  department: string | null;
  onDepartment: (value: string | null) => void;
  /** The picker steers its list from the search box. */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  listboxId?: string;
  activeId?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-faint"
        />
        <Input
          id={`${idPrefix}-search`}
          type="search"
          className="pl-10"
          placeholder="Search by name or initials"
          aria-label="Search by name or initials"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={onKeyDown}
          {...(listboxId
            ? {
                role: "combobox",
                "aria-expanded": true,
                "aria-controls": listboxId,
                "aria-activedescendant": activeId,
                "aria-autocomplete": "list" as const,
              }
            : {})}
        />
      </div>
      <OptionSelect
        id={`${idPrefix}-department`}
        value={department ?? ALL_DEPARTMENTS}
        onChange={(v) => onDepartment(v === ALL_DEPARTMENTS ? null : v)}
        options={departmentChoices}
      />
    </div>
  );
}
