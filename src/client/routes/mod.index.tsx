import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mod/")({
  beforeLoad: () => {
    throw redirect({ to: "/mod/queue" });
  },
});
