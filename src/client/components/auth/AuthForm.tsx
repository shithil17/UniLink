import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { focusRing } from "@/components/ui/focus";

/** The link style used for quiet text links across the auth screens. */
export const textLink = `rounded-control font-semibold text-brand-ink underline underline-offset-[3px] hover:decoration-2 ${focusRing}`;

/**
 * Shared frame for the sign up, log in and change password screens: a title, the fields straight on
 * the ground (no panel around them) and an optional footer, in one column up to 420px wide.
 *
 * The wordmark is not drawn here. `AppLayout` already shows it above these screens whenever there is
 * no tab bar (signed out, or a temporary password), and the rail carries it from `md` when there are
 * tabs, so a second one would double up.
 */
export function AuthScreen({
  title,
  intro,
  footer,
  back,
  children,
}: {
  title: string;
  intro?: string;
  footer?: ReactNode;
  /** A way back to the screen the user came from, for screens opened from another one. */
  back?: { to: "/settings"; label: string };
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-[420px] space-y-6 md:pt-6">
      {back ? (
        <Link
          to={back.to}
          className={`-mx-2 inline-flex h-11 items-center gap-1 rounded-control px-2 text-[15px] font-medium text-soft hover:text-ink ${focusRing}`}
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <header className="space-y-2">
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
          {title}
        </h1>
        {intro ? <p className="text-[15px] leading-normal text-soft">{intro}</p> : null}
      </header>
      {children}
      {footer ? <div className="text-[15px] text-soft">{footer}</div> : null}
    </section>
  );
}
