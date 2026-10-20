import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BellIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  HouseIcon,
  SettingsIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { InstallHint } from "@/components/pwa/InstallHint";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { focusRing } from "@/components/ui/focus";
import { Toaster } from "@/components/ui/sonner";
import { badgeLabel } from "@/lib/inbox";
import { mainTabs, type MainTab } from "@/lib/nav";
import { meQuery, unreadCountQuery } from "@/lib/queries";

const tabIcons: Record<MainTab["to"], LucideIcon> = {
  "/": HouseIcon,
  "/courses": BookOpenIcon,
  "/routine": CalendarDaysIcon,
  "/inbox": BellIcon,
  "/mod": ShieldCheckIcon,
  "/settings": SettingsIcon,
};

/**
 * The shell: a slim wordmark bar on top and the tabs at the bottom on phones; from `md` up the same
 * tabs sit in the top bar. The active tab shows by weight and ink, never by a fill. Signed out (or
 * while a temporary password is being replaced) there are no tabs, only the wordmark.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const me = useQuery(meQuery);
  // Only ask for the count once signed in; a failed poll just hides the badge.
  const unread = useQuery({ ...unreadCountQuery, enabled: me.data != null }).data?.count ?? 0;

  const tabs = mainTabs(me.data);

  return (
    <div
      className={`min-h-dvh bg-app text-body ${tabs.length > 0 ? "pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0" : ""}`}
    >
      <header className="sticky top-0 z-10 border-b border-line bg-app pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 md:h-14 md:px-6 lg:px-8">
          <Link
            to="/"
            className={`-mx-1 inline-flex h-11 items-center rounded-control px-1 text-base font-semibold text-ink ${focusRing}`}
          >
            UniLink
          </Link>
          {tabs.length > 0 ? (
            <nav
              aria-label="Main"
              className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-app pb-[env(safe-area-inset-bottom)] md:static md:gap-1 md:border-t-0 md:pb-0"
            >
              {tabs.map(({ to, label }) => {
                const Icon = tabIcons[to];
                return (
                  <Link
                    key={to}
                    to={to}
                    activeOptions={{ exact: to === "/" }}
                    className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-soft transition-colors hover:text-ink md:h-9 md:flex-none md:flex-row md:gap-2 md:rounded-control md:px-3 md:text-sm ${focusRing} [&.active]:font-semibold [&.active]:text-ink`}
                  >
                    <span className="relative">
                      <Icon className="size-5 md:size-4" aria-hidden="true" />
                      {to === "/inbox" && unread > 0 ? (
                        <span
                          aria-hidden="true"
                          className="absolute -top-1.5 left-3 flex h-4 min-w-4 items-center justify-center rounded-control bg-ink px-1 text-xs leading-none font-semibold text-app tabular-nums md:left-2.5"
                        >
                          {badgeLabel(unread)}
                        </span>
                      ) : null}
                    </span>
                    {/* The bold copy reserves the width, so the row does not shift when a tab turns active. */}
                    <span className="grid">
                      <span className="col-start-1 row-start-1">
                        {label}
                        {to === "/inbox" && unread > 0 ? (
                          <span className="sr-only">, {unread} unread</span>
                        ) : null}
                      </span>
                      <span
                        aria-hidden="true"
                        className="invisible col-start-1 row-start-1 font-semibold"
                      >
                        {label}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <InstallHint />
        {children}
      </main>
      <UpdatePrompt />
      <Toaster />
    </div>
  );
}
