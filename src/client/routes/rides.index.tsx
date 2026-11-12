import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { CarIcon, PlusIcon } from "lucide-react";
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
import {
  activeFilterCount,
  filtersOf,
  myRidesInfinite,
  parseRideSearch,
  RIDE_EXPIRY_WORDS,
  rideFeedInfinite,
  type RideFilters,
} from "@/lib/rides";

export const Route = createFileRoute("/rides/")({
  validateSearch: parseRideSearch,
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: Rides,
});

const panel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";

function Rides() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = search.tab ?? "find";
  const filters = filtersOf(search);

  const setTab = (next: "find" | "mine") =>
    void navigate({
      search: (previous) => ({ ...previous, tab: next === "mine" ? "mine" : undefined }),
      replace: true,
    });
  const setFilters = (patch: Partial<RideFilters>) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
  // Remounts the filter bar, so its search box empties along with the URL.
  const [cleared, setCleared] = useState(0);
  const clear = () => {
    setCleared((n) => n + 1);
    setFilters({ q: undefined, vehicle: undefined, date: undefined, day: undefined });
  };

  return (
    <div className="max-w-2xl space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
            Rides
          </h1>
          <p className="mt-1 text-soft">Share a ride to campus, or find one going your way.</p>
        </div>
        <Link to="/rides/new" className={buttonVariants({ size: "sm", className: "shrink-0" })}>
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
        <MyRides />
      ) : (
        <Feed key={cleared} filters={filters} onChange={setFilters} onClear={clear} />
      )}
    </div>
  );
}

function Feed({
  filters,
  onChange,
  onClear,
}: {
  filters: RideFilters;
  onChange: (patch: Partial<RideFilters>) => void;
  onClear: () => void;
}) {
  const list = useInfiniteQuery(rideFeedInfinite(filters));
  const rides = list.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = activeFilterCount(filters) > 0;

  return (
    <div className="space-y-5">
      <RideFiltersBar filters={filters} onChange={onChange} onClear={onClear} />
      {list.isPending ? (
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
                ? "Try another day or clear the filters."
                : "Post one and other students can find it."
            }
            action={
              filtered ? (
                <Button variant="outline" size="sm" onClick={onClear}>
                  Clear filters
                </Button>
              ) : (
                <Link to="/rides/new" className={buttonVariants({ size: "sm" })}>
                  Post a ride
                </Link>
              )
            }
          />
        </div>
      ) : (
        <>
          <RideList items={rides} />
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
    </div>
  );
}

function MyRides() {
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
              <Link to="/rides/new" className={buttonVariants({ size: "sm" })}>
                Post a ride
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <RideList items={rides} withBadge />
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
