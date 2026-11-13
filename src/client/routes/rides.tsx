import { useInfiniteQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  redirect,
  useMatch,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CarIcon, PlusIcon } from "lucide-react";
import { RideAreaMap } from "@/components/rides/RideAreaMap";
import { RideDetailHost, RIDE_SPLIT_QUERY } from "@/components/rides/RideDetailHost";
import { RideFiltersBar } from "@/components/rides/RideFilters";
import { RideList } from "@/components/rides/RideList";
import { RideSafetyNotice } from "@/components/rides/RideSafetyNotice";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api";
import { useSearchLayer, without } from "@/lib/map/useSearchLayer";
import { meQuery } from "@/lib/queries";
import { useRideAreaMap } from "@/lib/rideAreaMap";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  activeFilterCount,
  areaLayerValue,
  filtersOf,
  myRidesInfinite,
  parseAreaLayer,
  parseRideSearch,
  RIDE_EXPIRY_WORDS,
  rideFeedInfinite,
  type RideFilters,
  type RideView,
} from "@/lib/rides";

export const Route = createFileRoute("/rides")({
  validateSearch: parseRideSearch,
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: Rides,
});

/**
 * How long leaving the Map view waits for the history to settle after going back over its layers
 * before it lands anyway. A UI timing, so it is not in `limits.ts`: a back step resolves in a few
 * milliseconds, and this only bounds the case where the resolve never comes.
 */
const UNWIND_TIMEOUT_MS = 1000;

const panel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";

/**
 * The rides screen and, through the `/rides/$rideId` child route, the open ride. The child renders
 * nothing itself: the URL only says which ride is open, and `RideDetailHost` shows it as a bottom
 * sheet on phones and a side panel from `lg`. The list stays mounted underneath, so opening and
 * closing a ride keeps its scroll, filters and loaded pages. New and edit are separate full pages
 * (`rides_.new`, `rides_.$rideId.edit`), outside this layout.
 */
function Rides() {
  const search = Route.useSearch();
  // Relative to the current location, so filtering or switching tabs keeps the open ride open.
  const navigate = useNavigate();
  const router = useRouter();
  const wide = useMediaQuery(RIDE_SPLIT_QUERY);
  const rideId = useMatch({ from: "/rides/$rideId/", shouldThrow: false })?.params.rideId;
  // History state the row's link sets when it pushes the ride over the list, so closing goes back to
  // the list entry instead of stacking another. It lives in the entry, so it survives a trip to the
  // edit page and back, and is gone when a shared link opened the ride or the tab or filters changed
  // under it (those replace the entry), as the entry below no longer has the same search.
  const openedFromList = useLocation({ select: (l) => l.state.rideFromList === true });
  // The row that opened the ride, so closing the sheet puts focus back on it even where taps don't focus links.
  const openerRef = useRef<HTMLElement | null>(null);
  const tab = search.tab ?? "find";
  const filters = filtersOf(search);
  // The Map view belongs to the Find a ride tab.
  const view: RideView = tab === "find" && search.view === "map" ? "map" : "list";
  // The layers over the map: an area's rides, and a ride's detail over them. Each is one history step.
  const areaLayer = parseAreaLayer(search.area);
  const areaCtl = useSearchLayer("area");
  const detailCtl = useSearchLayer("ride");
  const areaMap = useRideAreaMap(filters, view === "map", areaLayer?.by);
  // Set when the Map view's entry on top of the history was pushed by this screen (below `lg`, where
  // the map is full screen): the rest of the search then, so closing goes back to the list entry
  // instead of stacking another, unless a filter was picked since (going back would undo it).
  const viewPushedFrom = useRef<string | null>(null);
  useEffect(() => {
    if (view !== "map") viewPushedFrom.current = null;
  }, [view]);
  // From `lg` the map fills the content area under the filter bar and the list is not shown.
  const inlineMap = view === "map" && wide;

  const setTab = (next: "find" | "mine") =>
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, tab: next === "mine" ? "mine" : undefined }),
      replace: true,
    });
  const setFilters = (patch: Partial<RideFilters>) =>
    void navigate({ to: ".", search: (previous) => ({ ...previous, ...patch }), replace: true });
  // Leaving the Map view while its layers are open: Back must not reopen them (or a ride that is
  // gone), so first go back over the entries this screen pushed (the layers, and the map's own entry
  // below `lg`), then run `land`, which replaces the entry it arrives on. Nothing pushed (a reload, or
  // no layer open) returns false and the caller replaces in place.
  const unwindLayers = (land: () => void) => {
    const layers = (areaCtl.pushed() ? 1 : 0) + (detailCtl.pushed() ? 1 : 0);
    if (layers === 0) return false;
    // Lands on the first resolve whatever the location (Back pressed meanwhile must not leave the
    // leave half done), or after a timeout if none comes, and only once.
    let landed = false;
    const finish = () => {
      if (landed) return;
      landed = true;
      off();
      clearTimeout(timer);
      land();
    };
    const off = router.subscribe("onResolved", finish);
    const timer = setTimeout(finish, UNWIND_TIMEOUT_MS);
    router.history.go(-(layers + (viewPushedFrom.current !== null ? 1 : 0)));
    return true;
  };
  // The search to land with: what is in the URL now (filters picked on the way included), without the Map view.
  const leaveMapSearch = () => ({
    ...router.state.location.search,
    view: undefined,
    area: undefined,
    ride: undefined,
  });
  const setView = (next: RideView) => {
    if (next === view) return;
    if (next === "list") {
      const search = leaveMapSearch();
      const land = () => void navigate({ to: ".", search, replace: true, resetScroll: false });
      if (unwindLayers(land)) return;
    }
    const push = next === "map" && !wide;
    viewPushedFrom.current = push ? without(router.state.location.search, "view") : null;
    void navigate({
      // The map has no open ride beside it, so it starts from the list route.
      to: next === "map" ? "/rides" : ".",
      search: (previous) => ({ ...previous, view: next === "map" ? "map" : undefined }),
      replace: !push,
      resetScroll: false,
    });
  };
  const closeView = () => {
    const search = leaveMapSearch();
    const land = () => void navigate({ to: ".", search, replace: true, resetScroll: false });
    if (unwindLayers(land)) return;
    if (
      viewPushedFrom.current !== null &&
      viewPushedFrom.current === without(router.state.location.search, "view")
    ) {
      router.history.back();
    } else {
      land();
    }
  };
  // The count card's button: open that area's rides over the map, in the direction being counted.
  const showRides = (areaId: number) => areaCtl.open(areaLayerValue(areaMap.by, areaId));
  // "Not on the map": the list is the place for those rides, so leave the Map view for it.
  const openList = closeView;
  const closeRide = () => {
    if (openedFromList) {
      router.history.back();
    } else {
      void navigate({ to: "/rides", search: true, replace: true });
    }
  };
  // The ride is gone, so land on the list's "mine" tab, where it no longer is.
  const rideDeleted = () => {
    const land = () => void navigate({ to: "/rides", search: { tab: "mine" }, replace: true });
    if (!unwindLayers(land)) land();
  };
  // Remounts the filter bar (not the list), so its search box empties along with the URL.
  const [cleared, setCleared] = useState(0);
  const clear = () => {
    setCleared((n) => n + 1);
    setFilters({
      q: undefined,
      from: undefined,
      to: undefined,
      vehicle: undefined,
      date: undefined,
      day: undefined,
    });
  };
  const onOpen = (row: HTMLElement) => {
    openerRef.current = row;
  };

  return (
    <div
      className={
        inlineMap
          ? "flex h-[calc(100dvh-4.5rem)] min-h-[36rem] flex-col gap-5"
          : "max-w-2xl lg:grid lg:max-w-none lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-8"
      }
    >
      <div className="min-w-0 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
              Rides
            </h1>
            <p className="mt-1 text-soft">Share a ride to campus, or find one going your way.</p>
          </div>
          <Link
            to="/rides/new"
            search
            className={buttonVariants({ size: "sm", className: "shrink-0" })}
          >
            <PlusIcon aria-hidden strokeWidth={1.75} />
            Post a ride
          </Link>
        </header>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "find" | "mine")}>
          <TabsList aria-label="Rides view" className="w-full sm:w-72">
            <TabsTrigger value="find">Find a ride</TabsTrigger>
            <TabsTrigger value="mine">My rides</TabsTrigger>
          </TabsList>
        </Tabs>

        <RideSafetyNotice />

        {tab === "mine" ? (
          <MyRides onOpen={onOpen} />
        ) : (
          <Feed
            barKey={cleared}
            filters={filters}
            onChange={setFilters}
            onClear={clear}
            onOpen={onOpen}
            view={view}
            onViewChange={setView}
            listHidden={inlineMap}
          />
        )}
      </div>
      {inlineMap ? null : (
        <RideDetailHost
          rideId={rideId}
          wide={wide}
          returnFocusTo={openerRef}
          onClose={closeRide}
          onDeleted={rideDeleted}
        />
      )}
      {tab === "find" && (inlineMap || !wide) ? (
        <RideAreaMap
          mode={inlineMap ? "inline" : "overlay"}
          open={view === "map"}
          onClose={closeView}
          model={areaMap}
          filters={filters}
          onFilters={setFilters}
          onOpenList={openList}
          area={areaLayer}
          detailId={search.ride ?? null}
          onShowRides={showRides}
          onOpenRide={detailCtl.open}
          onCloseArea={areaCtl.close}
          onCloseDetail={detailCtl.close}
          onDeleted={rideDeleted}
        />
      ) : null}
    </div>
  );
}

function Feed({
  barKey,
  filters,
  onChange,
  onClear,
  onOpen,
  view,
  onViewChange,
  listHidden,
}: {
  barKey: number;
  filters: RideFilters;
  onChange: (patch: Partial<RideFilters>) => void;
  onClear: () => void;
  onOpen: (row: HTMLElement) => void;
  view: RideView;
  onViewChange: (view: RideView) => void;
  /** The Map view from `lg` fills the area under the bar: only the bar shows, and the list is not fetched. */
  listHidden: boolean;
}) {
  const list = useInfiniteQuery({ ...rideFeedInfinite(filters), enabled: !listHidden });
  const rides = list.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = activeFilterCount(filters) > 0;

  return (
    <div className="space-y-5">
      <RideFiltersBar
        key={barKey}
        filters={filters}
        onChange={onChange}
        view={view}
        onViewChange={onViewChange}
      />
      {listHidden ? null : list.isPending || (list.isPlaceholderData && rides.length === 0) ? (
        <SkeletonRows rows={3} label="Loading rides" />
      ) : list.isError ? (
        <ErrorBlock
          title="Rides didn't load"
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : rides.length === 0 ? (
        <div className={panel}>
          <EmptyState
            icon={CarIcon}
            title={filtered ? "No rides match." : "No rides right now."}
            description={
              filtered
                ? filters.from || filters.to
                  ? "Try a broader area, which also covers its sub-areas, another day, or clear the filters."
                  : "Try another day or clear the filters."
                : "Post one and other students can find it."
            }
            action={
              filtered ? (
                <Button variant="outline" size="sm" onClick={onClear}>
                  Clear filters
                </Button>
              ) : (
                <Link to="/rides/new" search className={buttonVariants({ size: "sm" })}>
                  Post a ride
                </Link>
              )
            }
          />
        </div>
      ) : (
        // While the next filter loads, the last rides stay up, dimmed a little.
        <div
          aria-busy={list.isPlaceholderData}
          className={`space-y-5 transition-opacity duration-150 ${list.isPlaceholderData ? "opacity-60" : ""}`}
        >
          <RideList items={rides} onOpen={onOpen} />
          {list.hasNextPage && !list.isPlaceholderData ? (
            <Button
              variant="outline"
              className="w-full"
              loading={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Show more
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MyRides({ onOpen }: { onOpen: (row: HTMLElement) => void }) {
  const list = useInfiniteQuery(myRidesInfinite);
  const rides = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-[1.4] text-soft">
        {RIDE_EXPIRY_WORDS.one_off} {RIDE_EXPIRY_WORDS.recurring} {RIDE_EXPIRY_WORDS.deleted}
      </p>
      {list.isPending ? (
        <SkeletonRows rows={3} label="Loading your rides" />
      ) : list.isError ? (
        <ErrorBlock
          title="Your rides didn't load"
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : rides.length === 0 ? (
        <div className={panel}>
          <EmptyState
            icon={CarIcon}
            title="You haven't posted a ride."
            description="Going to campus most days? Post it once and let students join."
            action={
              <Link to="/rides/new" search className={buttonVariants({ size: "sm" })}>
                Post a ride
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <RideList items={rides} withBadge onOpen={onOpen} />
          {list.hasNextPage ? (
            <Button
              variant="outline"
              className="w-full"
              loading={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Show older
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
