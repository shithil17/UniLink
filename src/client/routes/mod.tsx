import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ModNav } from "@/components/mod/ModNav";
import { meQuery } from "@/lib/queries";

export const Route = createFileRoute("/mod")({
  // The server is the real guard; this only keeps students out of screens that would show errors.
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null);
    if (!user) throw redirect({ to: "/login" });
    if (user.role === "student") throw redirect({ to: "/" });
  },
  component: ModLayout,
});

function ModLayout() {
  const { data: me } = useQuery(meQuery);
  return (
    <div className="max-w-3xl space-y-5">
      <ModNav role={me && me.role !== "student" ? me.role : undefined} />
      <Outlet />
    </div>
  );
}
