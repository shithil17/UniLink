import { useQuery } from "@tanstack/react-query";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { BookOpenIcon, CalendarDaysIcon, HandHelpingIcon, type LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { chipClass } from "@/components/ui/chip";
import { NotFoundScene } from "@/components/layout/NotFoundScene";
import { meQuery } from "@/lib/queries";
import { mainTabs } from "@/lib/nav";

const QUICK_LINKS: {
  to: "/courses" | "/routine" | "/resources";
  label: string;
  Icon: LucideIcon;
}[] = [
  { to: "/courses", label: "Courses", Icon: BookOpenIcon },
  { to: "/routine", label: "Routine", Icon: CalendarDaysIcon },
  { to: "/resources", label: "Materials", Icon: HandHelpingIcon },
];

/**
 * What an unknown URL shows, inside the normal shell so the tab bar still works. A page state, not
 * a message, so there is no toast. "Go back" falls back to Home when the link was opened fresh and
 * there is nothing behind it.
 */
export function NotFoundScreen() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const signedIn = mainTabs(useQuery(meQuery).data).length > 0;

  function goBack() {
    if (router.history.canGoBack()) router.history.back();
    else void router.navigate({ to: "/" });
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-md flex-col items-center justify-center gap-6 py-6 text-center md:min-h-[calc(100dvh-8rem)] md:max-w-lg">
      <NotFoundScene className="max-w-[400px] md:max-w-[460px]" />
      <div className="grid justify-items-center gap-2">
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-balance text-ink md:text-[32px]">
          This page skipped class
        </h1>
        <p className="max-w-[34ch] text-soft">
          Page not found. The link may be old or mistyped, so head back and try again.
        </p>
      </div>
      <div className="grid w-full max-w-xs gap-3 min-[360px]:grid-cols-2">
        <Link to="/" className={buttonVariants({ size: "lg" })}>
          Back to home
        </Link>
        <Button variant="outline" size="lg" onClick={goBack}>
          Go back
        </Button>
      </div>
      {signedIn ? (
        <nav aria-label="Quick links" className="flex flex-wrap justify-center gap-2">
          {QUICK_LINKS.map(({ to, label, Icon }) => (
            <Link key={to} to={to} className={chipClass}>
              <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-soft" />
              {label}
            </Link>
          ))}
        </nav>
      ) : null}
      <p className="flex max-w-full items-center gap-2 text-[13px] text-faint">
        <span className="shrink-0">You asked for</span>
        <code className="min-w-0 truncate font-mono" title={pathname}>
          {pathname}
        </code>
      </p>
    </section>
  );
}
