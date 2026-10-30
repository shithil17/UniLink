import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PushSwitch } from "@/components/push/PushSwitch";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ThemeRow } from "@/components/theme/ThemeRow";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { meQuery, pushPublicKeyQuery } from "@/lib/queries";

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: Settings,
});

/** A flat panel: `surface`, radius 20 (24 from `md`), no border, rows carry their own hairlines. */
const panel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";
const row =
  "flex min-h-15 items-center gap-3 border-t border-line px-4 py-2.5 text-[15px] first:border-t-0";
const linkRow = `${row} w-full text-left font-medium text-ink outline-none hover:bg-tint active:bg-tint ${focusRing} focus-visible:-outline-offset-2 ${press}`;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
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
    <div className="max-w-2xl space-y-6">
      <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
        Settings
      </h1>
      <Group title="Account">
        <div className={panel}>
          {user ? (
            <div className={row}>
              <span className="flex-1 text-soft">Signed in as</span>
              <span className="min-w-0 truncate font-medium text-ink">{user.username}</span>
            </div>
          ) : null}
          <Link to="/change-password" className={linkRow}>
            <span className="flex-1">Change password</span>
            <ChevronRightIcon className="size-5 shrink-0 text-faint" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-3">
          <LogoutButton />
        </div>
      </Group>
      <Group title="Appearance">
        <div className={panel}>
          <ThemeRow className={linkRow} />
        </div>
      </Group>
      {push ? (
        <Group title="Notifications">
          <div className={panel}>
            <PushSwitch />
          </div>
        </Group>
      ) : null}
      {user && user.role !== "student" ? (
        <Group title="Moderation">
          <div className={panel}>
            <Link to="/mod/queue" className={linkRow}>
              <span className="flex-1">Moderation panel</span>
              <ChevronRightIcon className="size-5 shrink-0 text-faint" aria-hidden="true" />
            </Link>
          </div>
        </Group>
      ) : null}
    </div>
  );
}
