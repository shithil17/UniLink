import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { focusRing } from "@/components/ui/focus";

/** The link style used for quiet text links across the auth screens. */
export const textLink = `rounded-control text-brand underline underline-offset-4 ${focusRing}`;

/** Shared frame for the sign up, log in and change password screens: a title, the form in a panel, an optional footer. */
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
    <section className="mx-auto w-full max-w-sm space-y-5 md:pt-6">
      {back ? (
        <Link
          to={back.to}
          className={`-mx-2 inline-flex h-11 items-center gap-1 rounded-control px-2 text-sm text-soft hover:text-ink ${focusRing}`}
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {intro ? <p className="text-sm text-soft">{intro}</p> : null}
      </header>
      <div className="rounded-panel border border-line bg-surface p-5">{children}</div>
      {footer ? <div className="text-sm text-soft">{footer}</div> : null}
    </section>
  );
}
