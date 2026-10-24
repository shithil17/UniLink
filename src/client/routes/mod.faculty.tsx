import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, UsersIcon } from "lucide-react";
import { useState } from "react";
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
import { modFacultyList } from "@/lib/faculty";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
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
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [target, setTarget] = useState<FacultySheetTarget>(null);

  // The server searches every row; a new term, department or switch starts again at page one.
  const search = useDebouncedValue(query);
  const list = useInfiniteQuery(modFacultyList({ q: search, department, showHidden }));
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];

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
              search.trim() || department
                ? "No faculty match that search."
                : "No faculty have been added yet."
            }
          />
        </div>
      ) : (
        <>
          <ul className={panel} aria-busy={list.isPlaceholderData}>
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
          {list.hasNextPage ? (
            <Button
              variant="outline"
              className="w-full"
              loading={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Show more
            </Button>
          ) : null}
        </>
      )}

      <FacultySheet target={target} onClose={() => setTarget(null)} />
    </section>
  );
}
