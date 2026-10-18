import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet, redirect } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { meQuery } from "@/lib/queries";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // While a temporary password is set, nothing but the change-password screen is reachable.
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null);
    if (user?.mustChangePassword && location.pathname !== "/change-password") {
      throw redirect({ to: "/change-password" });
    }
  },
  component: RootLayout,
});

function RootLayout() {
  return (
    <ThemeProvider>
      <div className="min-h-dvh bg-app text-body">
        <nav className="flex gap-4 border-b border-line px-4 py-3 text-sm">
          <Link to="/" className="[&.active]:font-semibold">
            Home
          </Link>
          <Link to="/demo" className="[&.active]:font-semibold">
            Demo
          </Link>
          <Link to="/settings" className="[&.active]:font-semibold">
            Settings
          </Link>
        </nav>
        <main className="mx-auto max-w-xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </ThemeProvider>
  );
}
