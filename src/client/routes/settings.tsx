import { createFileRoute } from "@tanstack/react-router";
import { ThemePickerTrigger } from "@/components/theme/ThemePicker";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Settings</h1>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-soft">Appearance</h2>
        <ThemePickerTrigger />
      </div>
    </section>
  );
}
