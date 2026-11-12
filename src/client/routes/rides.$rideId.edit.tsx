import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { RideForm } from "@/components/rides/RideForm";
import { ErrorBlock } from "@/components/ui/error-block";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api";
import { meQuery } from "@/lib/queries";
import { ownContactsQuery, rideDetailQuery } from "@/lib/rides";

export const Route = createFileRoute("/rides/$rideId/edit")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: EditRide,
});

const panel = "rounded-panel bg-surface p-4 md:rounded-[24px] md:p-5";

function EditRide() {
  const raw = Route.useParams().rideId;
  const id = /^\d+$/.test(raw) ? Number(raw) : 0;
  const navigate = Route.useNavigate();
  const detail = useQuery({ ...rideDetailQuery(id), enabled: id > 0 });
  const own = detail.data?.mine === true;
  // The poster's contacts fill the form, so they are fetched only once the ride is known to be theirs.
  const contacts = useQuery({ ...ownContactsQuery(id), enabled: own });
  const toRide = () => void navigate({ to: "/rides/$rideId", params: { rideId: String(id) } });

  const missing = id === 0 || (detail.error instanceof ApiError && detail.error.status === 404);
  const loadError = detail.isError && !missing ? detail : contacts.isError ? contacts : null;

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
        Edit ride
      </h1>
      {missing || (detail.data && !own) ? (
        // Not found, or not theirs: the detail screen says what it can.
        <Navigate to="/rides" replace />
      ) : loadError ? (
        <ErrorBlock
          title="The ride didn't load"
          message={errorMessage(loadError.error)}
          onRetry={() => void loadError.refetch()}
          retrying={loadError.isRefetching}
        />
      ) : detail.data && contacts.data ? (
        <div className={panel}>
          <RideForm
            ride={detail.data}
            contacts={contacts.data.contacts}
            onSaved={toRide}
            onCancel={toRide}
          />
        </div>
      ) : (
        <div role="status" aria-label="Loading the ride" className={`${panel} grid gap-3`}>
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
    </div>
  );
}
