import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpenIcon,
  CalendarDaysIcon,
  CarIcon,
  CheckIcon,
  EllipsisIcon,
  HandHelpingIcon,
  HouseIcon,
  InboxIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { FloatingNotes } from "@/components/pwa/FloatingNotes";
import { InstallHint } from "@/components/pwa/InstallHint";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useDockHidden } from "@/lib/useDockHidden";
import { badgeLabel } from "@/lib/inbox";
import { AuthAside } from "@/components/auth/AuthForm";
import { Logo } from "@/components/layout/Logo";
import { activeTab, barPillIndex, isSplitAuthPath, mainTabs, type MainTab } from "@/lib/nav";
import { meQuery, unreadCountQuery } from "@/lib/queries";

const tabIcons: Record<MainTab["to"], LucideIcon> = {
  "/": HouseIcon,
  "/courses": BookOpenIcon,
  "/resources": HandHelpingIcon,
  "/rides": CarIcon,
  "/routine": CalendarDaysIcon,
  "/inbox": InboxIcon,
  "/mod": ShieldCheckIcon,
  "/settings": SettingsIcon,
};

const wordmark = "text-[22px] leading-none font-bold tracking-[-0.02em] text-ink";
const RAIL_STORAGE_KEY = "unilink-rail";
const RAIL_OPEN_DELAY_MS = 80;
const RAIL_CLOSE_DELAY_MS = 200;

/** Read before the first render, so the rail never flashes at the wrong width. */
function readRailPinnedOpen() {
  try {
    return localStorage.getItem(RAIL_STORAGE_KEY) !== "collapsed";
  } catch {
    return true;
  }
}

/**
 * The shell. Phones get no top bar: a floating pill tab bar sits 12px in from the sides and bottom
 * with a `brand-soft` pill that slides behind the active tab. From `md` the same nav becomes a 240px
 * left rail with the wordmark on top and the username at the bottom. It is one `<nav>` restyled by
 * breakpoint, so there is one set of links to test and to tab through. Signed out (or while a
 * temporary password is being replaced) there are no tabs and no rail, only the wordmark.
 *
 * The rail lists every tab. The phone bar shows only the `inBar` tabs plus a More button that opens
 * a bottom sheet with the rest; those links are hidden below `md` and More stands in for them. The
 * pill reads `--i` from `barPillIndex()`, so it sits on More while a More screen is open, and hides
 * with no active tab. On phones the bar slides away while scrolling down and back on scrolling up.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const dockHidden = useDockHidden();
  const [railPinnedOpen, setRailPinnedOpen] = useState(readRailPinnedOpen);
  const [railPeekOpen, setRailPeekOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const pointerInsideRail = useRef(false);
  // Set by a mouse collapse: the pointer is still on the rail, so hover must not reopen it until the
  // pointer has left once.
  const peekSuppressed = useRef(false);
  const railTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(RAIL_STORAGE_KEY, railPinnedOpen ? "expanded" : "collapsed");
    } catch {
      // The current session still uses the selected width when storage is unavailable.
    }
  }, [railPinnedOpen]);

  useEffect(
    () => () => {
      if (railTimer.current) clearTimeout(railTimer.current);
    },
    [],
  );

  function clearRailTimer() {
    if (railTimer.current) clearTimeout(railTimer.current);
    railTimer.current = null;
  }

  function scheduleRailPeek(open: boolean, delay: number) {
    clearRailTimer();
    railTimer.current = setTimeout(() => {
      const focusedInside = railRef.current?.contains(document.activeElement) ?? false;
      if (open || (!pointerInsideRail.current && !focusedInside)) setRailPeekOpen(open);
    }, delay);
  }

  function handleRailPointerEnter(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || railPinnedOpen || peekSuppressed.current) return;
    pointerInsideRail.current = true;
    scheduleRailPeek(true, RAIL_OPEN_DELAY_MS);
  }

  function handleRailPointerLeave(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || railPinnedOpen) return;
    peekSuppressed.current = false;
    pointerInsideRail.current = false;
    scheduleRailPeek(false, RAIL_CLOSE_DELAY_MS);
  }

  function handleRailFocus() {
    clearRailTimer();
    if (!railPinnedOpen && !peekSuppressed.current) setRailPeekOpen(true);
  }

  function handleRailBlur(event: FocusEvent<HTMLElement>) {
    if (railPinnedOpen || railRef.current?.contains(event.relatedTarget as Node)) return;
    scheduleRailPeek(false, RAIL_CLOSE_DELAY_MS);
  }

  function toggleRailPinnedOpen(event: MouseEvent<HTMLButtonElement>) {
    clearRailTimer();
    // `detail` is 0 for a keyboard press: keyboard users keep the peek so the focused button stays put.
    const byMouse = event.detail > 0;
    if (railPinnedOpen && byMouse) {
      peekSuppressed.current = true;
      pointerInsideRail.current = true;
    }
    setRailPinnedOpen(!railPinnedOpen);
    setRailPeekOpen(railPinnedOpen && !byMouse);
  }

  const me = useQuery(meQuery);
  // Only ask for the count once signed in; a failed poll just hides the badge.
  const unread = useQuery({ ...unreadCountQuery, enabled: me.data != null }).data?.count ?? 0;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search });

  const tabs = mainTabs(me.data);
  const pillIndex = barPillIndex(tabs, pathname);
  const current = activeTab(tabs, pathname);
  const moreTabs = tabs.filter((t) => !t.inBar);
  const barSlots = tabs.length - moreTabs.length + (moreTabs.length > 0 ? 1 : 0);
  const hasTabs = tabs.length > 0;
  const username = me.data?.username ?? "";
  // Signed out, log in and sign up go edge to edge from `lg`: `AuthAside` is the left column and
  // carries the wordmark. It sits outside `ScreenSwap` so it stays mounted between the two screens.
  const splitAuth = !hasTabs && isSplitAuthPath(pathname);
  // Sign up pairs its fields from `md`, so the wordmark above it widens with the column (see `AuthScreen`).
  const wideAuth = !hasTabs && pathname === "/signup";
  const wideCourses = pathname === "/courses" && (search as { view?: string }).view === "sequence";

  return (
    <div className="min-h-dvh bg-app text-body md:flex">
      {hasTabs ? (
        <aside
          ref={railRef}
          aria-label="Sidebar"
          data-collapsed={!railPinnedOpen}
          data-expanded={railPinnedOpen || railPeekOpen}
          onPointerEnter={handleRailPointerEnter}
          onPointerLeave={handleRailPointerLeave}
          onFocusCapture={handleRailFocus}
          onBlurCapture={handleRailBlur}
          className={`group relative z-20 contents md:sticky md:top-0 md:block md:h-dvh ${railPinnedOpen ? "md:w-60" : "md:w-[4.5rem]"} motion-safe:md:transition-[width] motion-safe:md:duration-200 motion-safe:md:ease-ui-out`}
        >
          <div
            className={`contents md:absolute md:inset-y-0 md:left-0 md:flex md:h-dvh md:flex-col md:overflow-y-auto md:bg-surface md:py-7 ${railPinnedOpen ? "md:w-60 md:px-4" : railPeekOpen ? "md:w-60 md:px-4 md:shadow-float" : "md:w-[4.5rem] md:px-3"} ${railPeekOpen && !railPinnedOpen ? "md:z-30" : "md:z-0"} motion-safe:md:transition-[width] motion-safe:md:duration-200 motion-safe:md:ease-ui-out`}
          >
            <Link
              to="/"
              aria-label="UniLink"
              className={`mb-6 hidden h-11 items-center gap-2 rounded-control px-3 md:flex ${wordmark} ${focusRing} ${railPinnedOpen || railPeekOpen ? "" : "justify-center px-0"}`}
            >
              <Logo className="h-6" />
              {railPinnedOpen || railPeekOpen ? <span>UniLink</span> : null}
            </Link>
            <nav
              aria-label="Main"
              data-dock-hidden={dockHidden ? "" : undefined}
              style={
                {
                  "--i": Math.max(pillIndex, 0),
                  "--n": barSlots,
                } as CSSProperties
              }
              className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 grid h-[68px] grid-flow-col auto-cols-fr dock-autohide rounded-full bg-surface p-1.5 shadow-float md:static md:flex md:h-auto md:flex-col md:gap-1.5 md:rounded-none md:bg-transparent md:p-0 md:shadow-none"
            >
              {/* The pill sits behind the links (they are `relative`, so they paint over it). */}
              <span
                aria-hidden="true"
                data-testid="tab-pill"
                data-hidden={pillIndex < 0 ? "" : undefined}
                className="pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/var(--n))] translate-x-[calc(var(--i)*100%)] rounded-full bg-brand-soft opacity-100 data-hidden:opacity-0 motion-safe:transition-[translate,opacity] motion-safe:duration-[280ms] motion-safe:ease-drawer md:hidden"
              />
              {tabs.map(({ to, label, inBar }) => {
                const Icon = tabIcons[to];
                const showBadge = to === "/inbox" && unread > 0;
                return (
                  <Link
                    key={to}
                    to={to}
                    activeOptions={{ exact: to === "/" }}
                    className={`relative flex flex-col items-center justify-center gap-0.5 rounded-full text-xs leading-[1.1] font-semibold text-soft outline-none aria-[current=page]:text-brand-ink md:min-h-12 md:flex-row md:justify-start md:gap-3 md:rounded-row md:px-3.5 md:text-[15px] md:leading-none md:aria-[current=page]:bg-brand-soft md:hover:bg-tint md:aria-[current=page]:hover:bg-brand-soft ${inBar ? "" : "max-md:hidden"} ${!railPinnedOpen && !railPeekOpen ? "md:size-12 md:justify-center md:gap-0 md:px-0" : ""} ${press} ${focusRing}`}
                  >
                    <Icon className="size-[22px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span className={!railPinnedOpen && !railPeekOpen ? "md:sr-only" : ""}>
                      {label}
                      {showBadge ? <span className="sr-only">, {unread} unread</span> : null}
                    </span>
                    {showBadge ? (
                      <span
                        aria-hidden="true"
                        className={`absolute top-1 left-[calc(50%+6px)] flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs leading-none font-bold text-primary-foreground ring-[3px] ring-surface ${!railPinnedOpen && !railPeekOpen ? "md:top-1 md:left-[calc(50%+6px)] md:h-4 md:min-w-4 md:px-1 md:text-[10px] md:ring-2" : "md:static md:ml-auto md:h-[22px] md:min-w-[22px] md:ring-0"}`}
                      >
                        {badgeLabel(unread)}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
              {moreTabs.length > 0 ? <MoreMenu tabs={moreTabs} current={current} /> : null}
            </nav>
            {/* Username only, never the student ID (the client never receives it). */}
            <div
              className={`mt-auto hidden items-center gap-2.5 pt-3 md:flex ${!railPinnedOpen && !railPeekOpen ? "flex-col px-0" : "px-3"}`}
            >
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink uppercase"
              >
                {username.slice(0, 1)}
              </span>
              <span
                className={`min-w-0 truncate text-sm font-medium text-soft ${!railPinnedOpen && !railPeekOpen ? "sr-only" : ""}`}
              >
                {username}
              </span>
              <button
                type="button"
                aria-label={railPinnedOpen ? "Collapse sidebar" : "Keep sidebar open"}
                onClick={toggleRailPinnedOpen}
                className={`hidden size-11 shrink-0 items-center justify-center rounded-control text-soft hover:bg-tint md:flex ${focusRing} ${press} ${!railPinnedOpen && !railPeekOpen ? "mt-1" : "ml-auto"}`}
              >
                {railPinnedOpen ? (
                  <PanelLeftCloseIcon
                    className="size-[22px]"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                ) : (
                  <PanelLeftOpenIcon
                    className="size-[22px]"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          </div>
        </aside>
      ) : null}
      {splitAuth ? <AuthAside /> : null}
      <div className={`min-w-0 flex-1 ${splitAuth ? "lg:flex lg:min-h-dvh lg:flex-col" : ""}`}>
        {/*
         * The wordmark header. With tabs it shows on phones only (the rail carries it from `md`);
         * signed out it sits over the 420px auth column (plus the 16px insets).
         */}
        <header
          className={
            hasTabs
              ? "px-4 pt-[calc(1rem+env(safe-area-inset-top))] md:hidden"
              : `mx-auto max-w-[calc(420px+2rem)] px-4 pt-[calc(1.75rem+env(safe-area-inset-top))] ${wideAuth ? "md:max-w-[calc(640px+2rem)]" : ""} ${splitAuth ? "lg:hidden" : ""}`
          }
        >
          <Link
            to="/"
            className={`-mx-3 inline-flex h-11 items-center gap-2 rounded-control px-3 ${wordmark} ${focusRing}`}
          >
            <Logo className="h-6" />
            UniLink
          </Link>
        </header>
        {/*
         * Phones clear the floating bar: 112px (12px inset + 68px bar + air) plus the home-indicator
         * inset. The column is 1240px wide with the rail, so the main part is 1240 minus the 240px rail.
         */}
        <main
          className={`mx-auto w-full ${wideCourses ? "max-w-none" : railPinnedOpen ? "max-w-[calc(1240px-15rem)]" : "max-w-[calc(1240px-4.5rem)]"} px-4 md:px-8 ${
            hasTabs
              ? "pt-3 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pt-9 md:pb-12"
              : "pt-6 pb-12"
          } ${splitAuth ? "lg:flex lg:max-w-none lg:flex-1 lg:items-center lg:justify-center lg:p-12" : ""}`}
        >
          <ScreenSwap pathname={pathname} fill={splitAuth}>
            {children}
          </ScreenSwap>
        </main>
      </div>
      <FloatingNotes>
        <UpdatePrompt />
        <InstallHint />
      </FloatingNotes>
      <Toaster />
    </div>
  );
}

/**
 * The phone bar's last slot: opens a bottom sheet with the tabs that do not fit the bar, one row
 * each with a plain line under the name. It takes the active colour (and the pill) while one of
 * those screens is open, so the bar always shows where you are. Hidden from `md`, where the rail
 * lists every tab.
 */
function MoreMenu({ tabs, current }: { tabs: MainTab[]; current: MainTab | undefined }) {
  const [open, setOpen] = useState(false);
  const inMore = current !== undefined && tabs.includes(current);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        data-current={inMore ? "" : undefined}
        render={
          <button
            type="button"
            className={`relative flex flex-col items-center justify-center gap-0.5 rounded-full text-xs leading-[1.1] font-semibold text-soft outline-none data-current:text-brand-ink md:hidden ${press} ${focusRing}`}
          />
        }
      >
        <EllipsisIcon className="size-[22px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>
          More
          {inMore ? <span className="sr-only">, {current.label} open</span> : null}
        </span>
      </SheetTrigger>
      <SheetContent side="bottom" className="data-[side=bottom]:gap-0">
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
          <SheetDescription className="sr-only">The rest of UniLink.</SheetDescription>
        </SheetHeader>
        <nav aria-label="More">
          <ul className="divide-y divide-line">
            {tabs.map((tab) => {
              const Icon = tabIcons[tab.to];
              const isCurrent = tab === current;
              return (
                <li key={tab.to}>
                  <Link
                    to={tab.to}
                    onClick={() => setOpen(false)}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`flex min-h-[60px] items-center gap-3.5 px-5 py-2.5 text-ink focus-visible:-outline-offset-2 ${focusRing} ${isCurrent ? "bg-brand-soft" : "hover:bg-tint active:bg-tint"}`}
                  >
                    <Icon
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className={`size-[22px] shrink-0 ${isCurrent ? "text-brand-ink" : "text-soft"}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`text-[15px] ${isCurrent ? "font-bold" : "font-medium"}`}>
                        {tab.label}
                      </span>
                      {tab.hint ? (
                        <span className="text-[13px] leading-[1.3] text-soft">{tab.hint}</span>
                      ) : null}
                    </span>
                    {isCurrent ? (
                      <CheckIcon aria-hidden="true" className="size-5 shrink-0 text-brand-ink" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
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
function ScreenSwap({
  pathname,
  fill,
  children,
}: {
  pathname: string;
  /** Span the width of a flex `main`, so a centred column keeps its size. */
  fill: boolean;
  children: ReactNode;
}) {
  return (
    <div key={pathname.split("/")[1] ?? ""} className={`screen-swap ${fill ? "lg:w-full" : ""}`}>
      {children}
    </div>
  );
}
