import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

const tabs = ["one", "two"] as const;

const demoSearch = z.object({
  tab: z.enum(tabs).default("one").catch("one"),
});

export const Route = createFileRoute("/demo")({
  validateSearch: demoSearch,
  component: Demo,
});

function Demo() {
  const { tab } = Route.useSearch();
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Search param demo</h1>
      <div className="flex gap-3">
        {tabs.map((value) => (
          <Link key={value} to="/demo" search={{ tab: value }} className="underline">
            {value}
          </Link>
        ))}
      </div>
      <p>
        Current tab: <span className="font-mono">{tab}</span>
      </p>
    </section>
  );
}
