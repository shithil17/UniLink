import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { FacultyFilters } from "@/components/faculty/FacultyFilters";
import { FacultyRowText } from "@/components/faculty/FacultyRowText";
import { FacultySheet, type FacultySheetTarget } from "@/components/mod/FacultySheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { focusRingInset } from "@/components/ui/focus";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/lib/api";
import { modFacultyQuery } from "@/lib/faculty";
import { searchFaculty } from "../../shared/facultySearch";

export const Route = createFileRoute("/mod/faculty")({
  component: FacultyPage,
});

const panel = "overflow-hidden rounded-panel border border-line bg-surface";
const flat = "rounded-control bg-tint";

function FacultyPage() {
  const list = useQuery(modFacultyQuery);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [target, setTarget] = useState<FacultySheetTarget>(null);

  const rows = useMemo(
    () => searchFaculty(list.data ?? [], { query, department, includeHidden: showHidden }),
    [list.data, query, department, showHidden],
  );
  const hiddenCount = (list.data ?? []).filter((f) => f.hidden).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Faculty</h1>
        <Button size="lg" onClick={() => setTarget("new")}>
          <PlusIcon data-icon="inline-start" />
          Add faculty
        </Button>
      </div>

      <FacultyFilters
        idPrefix="mod-faculty"
        query={query}
        onQuery={setQuery}
        department={department}
        onDepartment={setDepartment}
      />
      <div className="flex min-h-11 items-center gap-3">
        <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
        <Label htmlFor="show-hidden" className="text-sm text-body">
          Show hidden
          {hiddenCount > 0 ? (
            <span className="text-faint tabular-nums"> ({hiddenCount})</span>
          ) : null}
        </Label>
      </div>

      {list.isPending ? (
        <div className={panel} aria-busy="true" aria-label="Loading faculty">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="border-b border-line px-4 py-3 last:border-b-0">
              <div className={`${flat} h-4 w-1/3`} />
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">The list didn't load</p>
          <p className="mt-1 text-sm text-soft">{errorMessage(list.error)}</p>
          <Button variant="outline" className="mt-4" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">No faculty found</p>
          <p className="mt-1 text-sm text-soft">
            {query || department || showHidden
              ? "No faculty match that search."
              : "No faculty have been added yet."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-soft">
            <span className="tabular-nums">{rows.length}</span> faculty
          </p>
          <ul className={panel}>
            {rows.map((f) => (
              <li key={f.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => setTarget(f)}
                  className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-tint ${focusRingInset}`}
                >
                  <FacultyRowText faculty={f} />
                  {f.hidden ? <Badge>Hidden</Badge> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <FacultySheet target={target} onClose={() => setTarget(null)} />
    </section>
  );
}
