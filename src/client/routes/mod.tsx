import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { focusRing } from "@/components/ui/focus";
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

const tab = `relative inline-flex h-9 shrink-0 items-center rounded-control px-3 text-sm font-medium whitespace-nowrap text-soft transition-colors hover:text-ink ${focusRing} after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 [&.active]:text-ink [&.active]:after:bg-ink`;

function ModLayout() {
  const { data: me } = useQuery(meQuery);
  return (
    <div className="max-w-3xl space-y-5">
      <nav aria-label="Moderation" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max min-w-full gap-1 border-b border-line">
          <Link to="/mod/queue" className={tab}>
            Queue
          </Link>
          <Link to="/mod/users" className={tab}>
            Users
          </Link>
          <Link to="/mod/faculty" className={tab}>
            Faculty
          </Link>
          <Link to="/mod/courses" className={tab}>
            Courses
          </Link>
          <Link to="/mod/id-conflict" className={tab}>
            ID check
          </Link>
          {me?.role === "admin" ? (
            <Link to="/mod/audit" className={tab}>
              Audit log
            </Link>
          ) : null}
          <Link to="/mod/import" className={tab}>
            Import
          </Link>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
