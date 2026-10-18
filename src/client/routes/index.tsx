import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { healthQuery } from "../lib/queries";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(healthQuery),
  component: Home,
  errorComponent: ({ error }) => (
    <p role="alert">API unreachable: {error instanceof Error ? error.message : "unknown error"}</p>
  ),
});

function Home() {
  const { data } = useSuspenseQuery(healthQuery);
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">UniLink</h1>
      <p className="text-muted-foreground">
        API ok, database version <span className="font-mono">{data.dbVersion}</span>
      </p>
    </section>
  );
}
