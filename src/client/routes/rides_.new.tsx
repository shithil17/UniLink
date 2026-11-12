import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { RideForm } from "@/components/rides/RideForm";
import { meQuery } from "@/lib/queries";
import { parseRideSearch } from "@/lib/rides";

export const Route = createFileRoute("/rides_/new")({
  // The rides list's filters pass through this page, so Cancel lands back on them.
  validateSearch: parseRideSearch,
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: NewRide,
});

function NewRide() {
  const navigate = Route.useNavigate();
  const router = useRouter();
  // The new ride lands on "My rides", replacing the form so Back does not reopen it.
  const posted = () =>
    void navigate({
      to: "/rides",
      search: (previous) => ({ ...previous, tab: "mine" }),
      replace: true,
    });
  const cancel = () =>
    router.history.canGoBack()
      ? router.history.back()
      : void navigate({ to: "/rides", search: true, replace: true });

  return (
    <div className="max-w-2xl space-y-5">
      <header>
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
          Post a ride
        </h1>
        <p className="mt-1 text-soft">Offer seats to students going your way.</p>
      </header>
      <div className="rounded-panel bg-surface p-4 md:rounded-[24px] md:p-5">
        <RideForm onSaved={posted} onCancel={cancel} />
      </div>
    </div>
  );
}
