import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpenIcon,
  CalendarDaysIcon,
  HouseIcon,
  InboxIcon,
  SettingsIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { InstallHint } from "@/components/pwa/InstallHint";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { Toaster } from "@/components/ui/sonner";
import { badgeLabel } from "@/lib/inbox";
import { activeTabIndex, mainTabs, type MainTab } from "@/lib/nav";
import { meQuery, unreadCountQuery } from "@/lib/queries";

const tabIcons: Record<MainTab["to"], LucideIcon> = {
  "/": HouseIcon,
  "/courses": BookOpenIcon,
  "/routine": CalendarDaysIcon,
  "/inbox": InboxIcon,
  "/mod": ShieldCheckIcon,
  "/settings": SettingsIcon,
};

const wordmark = "text-[22px] leading-none font-bold tracking-[-0.02em] text-ink";

/**
 * The shell. Phones get no top bar: a floating pill tab bar sits 12px in from the sides and bottom
 * with a `brand-soft` pill that slides behind the active tab. From `md` the same nav becomes a 240px
 * left rail with the wordmark on top and the username at the bottom. It is one `<nav>` restyled by
 * breakpoint, so there is one set of links to test and to tab through. Signed out (or while a
 * temporary password is being replaced) there are no tabs and no rail, only the wordmark.
 *
 * The pill reads `--i`, the active tab's position in `mainTabs()`, so the bar works for five student
 * tabs and five mod tabs alike. With no active tab (a screen reached from elsewhere) the pill hides.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const me = useQuery(meQuery);
  // Only ask for the count once signed in; a failed poll just hides the badge.
  const unread = useQuery({ ...unreadCountQuery, enabled: me.data != null }).data?.count ?? 0;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = mainTabs(me.data);
  const activeIndex = activeTabIndex(tabs, pathname);
  const hasTabs = tabs.length > 0;
  const username = me.data?.username ?? "";

  return (
    <div className="min-h-dvh bg-app text-body md:flex">
      {hasTabs ? (
        <div className="contents md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto md:bg-surface md:px-4 md:py-7">
          <Link
            to="/"
            className={`mb-6 hidden h-11 items-center rounded-control px-3 md:flex ${wordmark} ${focusRing}`}
          >
            UniLink
          </Link>
          <nav
            aria-label="Main"
            style={
              {
                "--i": Math.max(activeIndex, 0),
                "--n": tabs.length,
              } as CSSProperties
            }
            className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 grid h-[68px] grid-flow-col auto-cols-fr rounded-full bg-surface p-1.5 shadow-float md:static md:flex md:h-auto md:flex-col md:gap-1.5 md:rounded-none md:bg-transparent md:p-0 md:shadow-none"
          >
            {/* The pill sits behind the links (they are `relative`, so they paint over it). */}
            <span
              aria-hidden="true"
              data-testid="tab-pill"
              data-hidden={activeIndex < 0 ? "" : undefined}
              className="pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/var(--n))] translate-x-[calc(var(--i)*100%)] rounded-full bg-brand-soft opacity-100 data-hidden:opacity-0 motion-safe:transition-[translate,opacity] motion-safe:duration-[280ms] motion-safe:ease-drawer md:hidden"
            />
            {tabs.map(({ to, label }) => {
              const Icon = tabIcons[to];
              const showBadge = to === "/inbox" && unread > 0;
              return (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: to === "/" }}
                  className={`relative flex flex-col items-center justify-center gap-0.5 rounded-full text-xs leading-[1.1] font-semibold text-soft outline-none aria-[current=page]:text-brand-ink md:min-h-12 md:flex-row md:justify-start md:gap-3 md:rounded-row md:px-3.5 md:text-[15px] md:leading-none md:aria-[current=page]:bg-brand-soft md:hover:bg-tint md:aria-[current=page]:hover:bg-brand-soft ${press} ${focusRing}`}
                >
                  <Icon className="size-[22px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span>
                    {label}
                    {showBadge ? <span className="sr-only">, {unread} unread</span> : null}
                  </span>
                  {showBadge ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 left-[calc(50%+6px)] flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs leading-none font-bold text-primary-foreground ring-[3px] ring-surface md:static md:ml-auto md:h-[22px] md:min-w-[22px] md:ring-0"
                    >
                      {badgeLabel(unread)}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          {/* Username only, never the student ID (the client never receives it). */}
          <div className="mt-auto hidden items-center gap-2.5 px-3 pt-3 md:flex">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink uppercase"
            >
              {username.slice(0, 1)}
            </span>
            <span className="min-w-0 truncate text-sm font-medium text-soft">{username}</span>
          </div>
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        {hasTabs ? null : (
          <header className="mx-auto max-w-lg px-4 pt-[calc(1.75rem+env(safe-area-inset-top))] md:px-8">
            <Link
              to="/"
              className={`-mx-3 inline-flex h-11 items-center rounded-control px-3 ${wordmark} ${focusRing}`}
            >
              UniLink
            </Link>
          </header>
        )}
        {/*
         * Phones clear the floating bar: 112px (12px inset + 68px bar + air) plus the home-indicator
         * inset. The column is 1240px wide with the rail, so the main part is 1240 minus the 240px rail.
         */}
        <main
          className={`mx-auto w-full max-w-[calc(1240px-15rem)] px-4 md:px-8 ${
            hasTabs
              ? "pt-[calc(1.75rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] md:pt-9 md:pb-12"
              : "pt-6 pb-12"
          }`}
        >
          <InstallHint />
          <ScreenSwap pathname={pathname}>{children}</ScreenSwap>
        </main>
      </div>
      <UpdatePrompt />
      <Toaster />
    </div>
  );
}

/**
 * Fades a new top-level screen in (opacity only, 120ms). Keyed on the first path segment, so moving
 * between a screen's own sub-screens (the mod panel's sections) does not remount and flash the shell
 * of that screen.
 *
 * ceiling: no shared-element transitions and no View Transitions API. A tab switch happens a hundred
 * times a day and has to feel instant; a fade is the most it earns. Revisit only if a single
 * flow (say, opening a course from the map) gains something a student would notice from continuity.
 */
function ScreenSwap({ pathname, children }: { pathname: string; children: ReactNode }) {
  return (
    <div key={pathname.split("/")[1] ?? ""} className="screen-swap">
      {children}
    </div>
  );
}
