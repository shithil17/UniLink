import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ThemePickerTrigger } from "@/components/theme/ThemePicker";
import { buttonVariants } from "@/components/ui/button";
import { meQuery } from "@/lib/queries";

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: Settings,
});

function Settings() {
  const { data: user } = useQuery(meQuery);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Settings</h1>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-soft">Appearance</h2>
        <ThemePickerTrigger />
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-soft">Account</h2>
        {user ? <p className="text-body">Signed in as {user.username}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/change-password"
            className={buttonVariants({ variant: "outline", className: "h-11" })}
          >
            Change password
          </Link>
          <LogoutButton />
        </div>
      </div>
      {user && user.role !== "student" ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-soft">Moderation</h2>
          <Link
            to="/mod/import"
            className={buttonVariants({ variant: "outline", className: "h-11" })}
          >
            Import a curriculum
          </Link>
        </div>
      ) : null}
    </section>
  );
}
