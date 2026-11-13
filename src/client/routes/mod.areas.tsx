import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MapPinIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { AREA_POINT_MAP, AreaSheet, type AreaSheetTarget } from "@/components/mod/AreaSheet";
import { modPanel as panel, modRowLine, modRowMin, modTitle } from "@/components/mod/modStyles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { focusRingInset } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { groupAreas, modAreasQuery } from "@/lib/areas";
import { parseMapParam, useMapParam } from "@/lib/map/useMapParam";
import type { ModArea } from "../../shared/schemas/areas";

export const Route = createFileRoute("/mod/areas")({
  // The point picker is a full-screen map, opened through `?map=`.
  validateSearch: (search: Record<string, unknown>) => ({ map: parseMapParam(search.map) }),
  component: AreasPage,
});

const skeletonRow = (
  <div className="grid min-w-0 flex-1 gap-1.5">
    <Skeleton className="h-4 w-2/5" />
  </div>
);

function AreasPage() {
  const list = useQuery(modAreasQuery);
  const [target, setTarget] = useState<AreaSheetTarget>(null);
  const groups = groupAreas(list.data ?? []);
  // The sheet shows the freshest row, so a point just saved shows without reopening it.
  const shown: AreaSheetTarget =
    target?.mode === "edit"
      ? { ...target, area: list.data?.find((a) => a.id === target.area.id) ?? target.area }
      : target;

  // A reload or a shared link on `?map=area-point` has no area to place: drop the param.
  const pointMap = useMapParam(AREA_POINT_MAP);
  useEffect(() => {
    if (pointMap.isOpen) pointMap.close();
    // Only on arrival: later the picker opens from the sheet and owns the param.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className={modTitle}>Areas</h1>
        <Button onClick={() => setTarget({ mode: "add", parent: null })}>
          <PlusIcon data-icon="inline-start" />
          Add area
        </Button>
      </div>
      <p className="text-soft">
        The places students pick for rides. Hiding an area keeps it on rides that already use it.
      </p>

      {list.isPending ? (
        <SkeletonRows rows={5} row={skeletonRow} label="Loading areas" />
      ) : list.isError ? (
        <ErrorBlock
          title="The areas didn't load"
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : groups.length === 0 ? (
        <div className={panel}>
          <EmptyState
            icon={MapPinIcon}
            title="No areas yet"
            description="Add the first area so students can post rides."
          />
        </div>
      ) : (
        <ul className={panel}>
          {groups.map(({ area, children }) => (
            <li key={area.id} className={modRowLine}>
              <AreaRowButton
                area={area}
                onOpen={() => setTarget({ mode: "edit", area, parent: null })}
              />
              {children.length > 0 ? (
                <ul>
                  {children.map((child) => (
                    <li key={child.id} className="border-t border-line">
                      <AreaRowButton
                        area={child}
                        sub
                        onOpen={() => setTarget({ mode: "edit", area: child, parent: area })}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <AreaSheet target={shown} parents={groups.map((g) => g.area)} onTarget={setTarget} />
    </section>
  );
}

/** One area as a row. A hidden one says so, and says why when there is room. */
function AreaRowButton({
  area,
  sub = false,
  onOpen,
}: {
  area: ModArea;
  sub?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 py-2.5 pr-4 text-left hover:bg-tint active:bg-tint ${modRowMin} ${sub ? "pl-9" : "pl-4"} ${press} ${focusRingInset}`}
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span
          className={`text-[15px] leading-[1.3] break-words ${sub ? "text-soft" : "font-semibold text-ink"} ${area.hidden ? "line-through decoration-faint" : ""}`}
        >
          {area.name}
        </span>
        {area.hidden && area.hiddenReason ? (
          <span className="text-[13px] leading-[1.4] break-words text-soft">
            Hidden: {area.hiddenReason}
          </span>
        ) : null}
      </span>
      {area.hidden ? <Badge className="shrink-0">Hidden</Badge> : null}
    </button>
  );
}
