import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { CarIcon } from "lucide-react";
import { ReportButton } from "@/components/posts/ReportButton";
import { StatusNote } from "@/components/posts/StatusNote";
import { RideContact } from "@/components/rides/RideContact";
import { RideDetailPanel } from "@/components/rides/RideDetailPanel";
import { RideOwnerActions } from "@/components/rides/RideOwnerActions";
import { RideSafetyNotice } from "@/components/rides/RideSafetyNotice";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api";
import { meQuery } from "@/lib/queries";
import { RIDE_REPORT_DESCRIPTION, rideDetailQuery } from "@/lib/rides";

export const Route = createFileRoute("/rides/$rideId/")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: RideScreen,
});

const panel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";

function RideScreen() {
  const raw = Route.useParams().rideId;
  const id = /^\d+$/.test(raw) ? Number(raw) : 0;
  const navigate = Route.useNavigate();
  const detail = useQuery({ ...rideDetailQuery(id), enabled: id > 0 });
  const gone = id === 0 || (detail.error instanceof ApiError && detail.error.status === 404);
  const ride = detail.data;

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-balance break-words text-ink md:text-[32px]">
        {ride ? `${ride.pickupArea.name} to ${ride.destinationArea.name}` : "Ride"}
      </h1>
      {gone ? (
        <div className={panel}>
          <EmptyState
            icon={CarIcon}
            title="This ride isn't available."
            description="It already left, or it was deleted or removed."
            action={
              <Link to="/rides" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Back to rides
              </Link>
            }
          />
        </div>
      ) : detail.isPending ? (
        <div role="status" aria-label="Loading the ride" className={`${panel} grid gap-3 p-4`}>
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : detail.isError ? (
        <ErrorBlock
          title="The ride didn't load"
          message={errorMessage(detail.error)}
          onRetry={() => void detail.refetch()}
          retrying={detail.isRefetching}
        />
      ) : (
        <>
          {ride?.mine ? (
            <StatusNote
              status={ride.status}
              what="ride"
              category={ride.rejectionCategory}
              appeal={{ targetType: "ride", id: ride.id }}
            />
          ) : null}
          {ride ? <RideDetailPanel ride={ride} /> : null}
          {ride?.mine ? (
            <RideOwnerActions
              ride={ride}
              onDeleted={() => void navigate({ to: "/rides", search: { tab: "mine" } })}
            />
          ) : ride ? (
            <>
              <RideContact rideId={ride.id} />
              <ReportButton
                type="ride"
                id={ride.id}
                label="Report this ride"
                description={RIDE_REPORT_DESCRIPTION}
              />
            </>
          ) : null}
          <RideSafetyNotice />
        </>
      )}
    </div>
  );
}
