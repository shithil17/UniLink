import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-ink">Welcome to UniLink</h1>
      <p className="text-soft">Your NSU CSE student companion. More is on the way.</p>
    </section>
  );
}
