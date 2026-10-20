import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PushSwitch } from "@/components/push/PushSwitch";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ThemePickerTrigger } from "@/components/theme/ThemePicker";
import { focusRingInset } from "@/components/ui/focus";
import { meQuery, pushPublicKeyQuery } from "@/lib/queries";

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: Settings,
});

const panel = "overflow-hidden rounded-panel border border-line bg-surface";
const row = "flex min-h-14 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0";
const linkRow = `${row} w-full text-left text-ink transition-colors hover:bg-tint ${focusRingInset}`;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

function Settings() {
  const { data: user } = useQuery(meQuery);
  // No key means the server has push switched off, so the row would only be a dead end.
  const { data: push } = useQuery(pushPublicKeyQuery);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold text-ink">Settings</h1>
      <Group title="Appearance">
        <ThemePickerTrigger />
      </Group>
      {push ? (
        <Group title="Notifications">
          <div className={panel}>
            <PushSwitch />
          </div>
        </Group>
      ) : null}
      <Group title="Account">
        <div className={panel}>
          {user ? (
            <div className={row}>
              <span className="flex-1 text-sm text-soft">Signed in as</span>
              <span className="font-medium text-ink">{user.username}</span>
            </div>
          ) : null}
          <Link to="/change-password" className={linkRow}>
            <span className="flex-1">Change password</span>
            <ChevronRightIcon className="size-4 shrink-0 text-faint" aria-hidden="true" />
          </Link>
        </div>
        <LogoutButton />
      </Group>
      {user && user.role !== "student" ? (
        <Group title="Moderation">
          <div className={panel}>
            <Link to="/mod/import" className={linkRow}>
              <span className="flex-1">Import a curriculum</span>
              <ChevronRightIcon className="size-4 shrink-0 text-faint" aria-hidden="true" />
            </Link>
          </div>
        </Group>
      ) : null}
    </div>
  );
}
