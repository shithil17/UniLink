import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { createQueryClient } from "./lib/queryClient";
import { routeTree } from "./routeTree.gen";

const queryClient = createQueryClient();

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // Loaders hand off to TanStack Query, which owns caching.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

// The service worker asks the open app to show a page when a notification is tapped
// (public/push-sw.js). Only same-origin paths are followed.
navigator.serviceWorker?.addEventListener("message", (event: MessageEvent) => {
  const { type, url } = (event.data ?? {}) as { type?: unknown; url?: unknown };
  if (type !== "unilink:navigate" || typeof url !== "string") return;
  if (!url.startsWith("/") || url.startsWith("//")) return;
  router.history.push(url);
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
