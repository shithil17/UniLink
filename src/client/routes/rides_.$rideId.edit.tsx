import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, redirect, useRouter } from "@tanstack/react-router";
import { RideForm } from "@/components/rides/RideForm";
import { ErrorBlock } from "@/components/ui/error-block";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api";
import { meQuery } from "@/lib/queries";
import { ownContactsQuery, parseRideSearch, rideDetailQuery } from "@/lib/rides";

export const Route = createFileRoute("/rides_/$rideId/edit")({
  // The rides list's filters and tab pass through this page, so Save and Cancel land back on them.
  validateSearch: parseRideSearch,
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
  const router = useRouter();
  const detail = useQuery({ ...rideDetailQuery(id), enabled: id > 0 });
  const own = detail.data?.mine === true;
  // The poster's contacts fill the form, so they are fetched only once the ride is known to be theirs.
  const contacts = useQuery({ ...ownContactsQuery(id), enabled: own });
  // The detail the edit was opened from is the entry below this one, so going back to it (or
  // replacing the edit entry when there is none) keeps Back from reopening the form or the ride twice.
  const leave = () =>
    router.history.canGoBack()
      ? router.history.back()
      : void navigate({
          to: "/rides/$rideId",
          params: { rideId: String(id) },
          search: true,
          replace: true,
        });

  const missing = id === 0 || (detail.error instanceof ApiError && detail.error.status === 404);
  const loadError = detail.isError && !missing ? detail : contacts.isError ? contacts : null;

  return (
    <div className="max-w-2xl space-y-5 lg:max-w-6xl">
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
        <RideForm
          ride={detail.data}
          contacts={contacts.data.contacts}
          onSaved={leave}
          onCancel={leave}
        />
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
