import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { FacultyFilters } from "@/components/faculty/FacultyFilters";
import { FacultyRowText } from "@/components/faculty/FacultyRowText";
import { FacultySheet, type FacultySheetTarget } from "@/components/mod/FacultySheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { focusRingInset } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { modFacultyQuery } from "@/lib/faculty";
import { searchFaculty } from "../../shared/facultySearch";
import { modPanel as panel, modTitle } from "@/components/mod/modStyles";

export const Route = createFileRoute("/mod/faculty")({
  component: FacultyPage,
});

/** The loading row in the final layout: a name, a muted line and no trailing badge. */
const skeletonRow = (
  <div className="grid min-w-0 flex-1 gap-1.5">
    <Skeleton className="h-4 w-2/5" />
    <Skeleton className="h-3.5 w-3/5" />
  </div>
);

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
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className={modTitle}>Faculty</h1>
        <Button onClick={() => setTarget("new")}>
          <PlusIcon data-icon="inline-start" />
          Add faculty
        </Button>
      </div>

      <div className="space-y-3">
        <FacultyFilters
          idPrefix="mod-faculty"
          query={query}
          onQuery={setQuery}
          department={department}
          onDepartment={setDepartment}
        />
        <Chip pressed={showHidden} onPressedChange={setShowHidden}>
          Show hidden
          {hiddenCount > 0 ? (
            <span className="text-faint tabular-nums">({hiddenCount})</span>
          ) : null}
        </Chip>
      </div>

      {list.isPending ? (
        <SkeletonRows rows={4} row={skeletonRow} label="Loading faculty" />
      ) : list.isError ? (
        <ErrorBlock
          title="The list didn't load"
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : rows.length === 0 ? (
        <div className={panel}>
          <EmptyState
            icon={UsersIcon}
            title="No faculty found"
            description={
              query || department || showHidden
                ? "No faculty match that search."
                : "No faculty have been added yet."
            }
          />
        </div>
      ) : (
        <>
          <p className="text-[13px] leading-[1.3] font-medium text-soft">
            <span className="tabular-nums">{rows.length}</span> faculty
          </p>
          <ul className={panel}>
            {rows.map((f) => (
              <li key={f.id} className="border-t border-line first:border-t-0">
                <button
                  type="button"
                  onClick={() => setTarget(f)}
                  className={`flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-tint active:bg-tint ${press} ${focusRingInset}`}
                >
                  <FacultyRowText faculty={f} />
                  {f.hidden ? <Badge className="shrink-0">Hidden</Badge> : null}
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
