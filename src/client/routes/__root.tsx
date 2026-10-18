import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  redirect,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { OfflineScreen } from "@/components/pwa/OfflineScreen";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { isOffline } from "@/lib/api";
import { meQuery } from "@/lib/queries";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // While a temporary password is set, nothing but the change-password screen is reachable.
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch((err: unknown) => {
      // No network on the first API call: let the error screen show the offline state.
      if (isOffline(err)) throw err;
      return null;
    });
    if (user?.mustChangePassword && location.pathname !== "/change-password") {
      throw redirect({ to: "/change-password" });
    }
  },
  component: RootLayout,
  errorComponent: RootError,
});

function RootLayout() {
  return (
    <ThemeProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ThemeProvider>
  );
}

function RootError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const retry = () => {
    reset();
    void router.invalidate();
  };

  return (
    <ThemeProvider>
      {isOffline(error) ? (
        <OfflineScreen onRetry={retry} />
      ) : (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-app px-6 text-center text-body">
          <h1 className="text-2xl font-semibold text-ink">Something went wrong</h1>
          <button type="button" className="text-brand underline" onClick={retry}>
            Try again
          </button>
        </main>
      )}
    </ThemeProvider>
  );
}
