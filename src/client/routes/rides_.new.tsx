import { createFileRoute, redirect } from "@tanstack/react-router";
import { RideForm } from "@/components/rides/RideForm";
import { meQuery } from "@/lib/queries";

export const Route = createFileRoute("/rides_/new")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: NewRide,
});

function NewRide() {
  const navigate = Route.useNavigate();
  const back = () => void navigate({ to: "/rides", search: { tab: "mine" } });

  return (
    <div className="max-w-2xl space-y-5">
      <header>
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
          Post a ride
        </h1>
        <p className="mt-1 text-soft">Offer seats to students going your way.</p>
      </header>
      <div className="rounded-panel bg-surface p-4 md:rounded-[24px] md:p-5">
        <RideForm onSaved={back} onCancel={() => void navigate({ to: "/rides" })} />
      </div>
    </div>
  );
}
