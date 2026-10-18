import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <nav className="flex gap-4 border-b border-border px-4 py-3 text-sm">
        <Link to="/" className="[&.active]:font-semibold">
          Home
        </Link>
        <Link to="/demo" className="[&.active]:font-semibold">
          Demo
        </Link>
      </nav>
      <main className="mx-auto max-w-xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
