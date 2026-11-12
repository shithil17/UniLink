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
import { useRef, useState } from "react";
import { CarIcon, PlusIcon } from "lucide-react";
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
import { meQuery } from "@/lib/queries";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  activeFilterCount,
  filtersOf,
  myRidesInfinite,
  parseRideSearch,
  RIDE_EXPIRY_WORDS,
  rideFeedInfinite,
  type RideFilters,
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

  const setTab = (next: "find" | "mine") =>
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, tab: next === "mine" ? "mine" : undefined }),
      replace: true,
    });
  const setFilters = (patch: Partial<RideFilters>) =>
    void navigate({ to: ".", search: (previous) => ({ ...previous, ...patch }), replace: true });
  const closeRide = () => {
    if (openedFromList) {
      router.history.back();
    } else {
      void navigate({ to: "/rides", search: true, replace: true });
    }
  };
  // The ride is gone, so land on the list's "mine" tab, where it no longer is.
  const rideDeleted = () => {
    void navigate({ to: "/rides", search: { tab: "mine" }, replace: true });
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
    <div className="max-w-2xl lg:grid lg:max-w-none lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
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
          />
        )}
      </div>
      <RideDetailHost
        rideId={rideId}
        wide={wide}
        returnFocusTo={openerRef}
        onClose={closeRide}
        onDeleted={rideDeleted}
      />
    </div>
  );
}

function Feed({
  barKey,
  filters,
  onChange,
  onClear,
  onOpen,
}: {
  barKey: number;
  filters: RideFilters;
  onChange: (patch: Partial<RideFilters>) => void;
  onClear: () => void;
  onOpen: (row: HTMLElement) => void;
}) {
  const list = useInfiniteQuery(rideFeedInfinite(filters));
  const rides = list.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = activeFilterCount(filters) > 0;

  return (
    <div className="space-y-5">
      <RideFiltersBar key={barKey} filters={filters} onChange={onChange} />
      {list.isPending || (list.isPlaceholderData && rides.length === 0) ? (
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
