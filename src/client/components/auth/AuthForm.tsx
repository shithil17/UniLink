import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SampleWeek } from "@/components/auth/SampleWeek";
import { focusRing } from "@/components/ui/focus";

/** The link style used for quiet text links across the auth screens. */
export const textLink = `rounded-control font-semibold text-brand-ink underline underline-offset-[3px] hover:decoration-2 ${focusRing}`;

const UNOFFICIAL_TEXT =
  "UniLink is made and moderated by NSU students. It isn't run or endorsed by the university.";

/**
 * The line under the log in and sign up screens that says plainly who runs UniLink. From `lg` the
 * split screens carry the same line in their left panel, so this one steps aside.
 */
export function UnofficialNote() {
  return <p className="mt-8 text-[13px] leading-[1.4] text-faint lg:hidden">{UNOFFICIAL_TEXT}</p>;
}

/**
 * The left panel of the split log in and sign up screens, shown from `lg`: a flat `brand-soft`
 * field pinned to the viewport (so it stays put while a long form scrolls) with the wordmark on top,
 * the pitch and the sample week centered in the space between, and the unofficial note at the foot.
 * `AppLayout` renders it, outside the screen fade, so it stays mounted (and the board does not replay)
 * when moving between log in and sign up.
 */
export function AuthAside() {
  return (
    <aside className="hidden h-dvh w-[46%] max-w-[640px] shrink-0 flex-col overflow-y-auto bg-brand-soft p-12 text-brand-ink lg:sticky lg:top-0 lg:flex">
      <Link
        to="/"
        className={`-mx-3 inline-flex h-11 w-fit items-center rounded-control px-3 text-[22px] leading-none font-bold tracking-[-0.02em] text-brand-ink ${focusRing}`}
      >
        UniLink
      </Link>
      <div className="my-auto max-w-[440px] py-8">
        <h2 className="text-[40px] leading-[1.1] font-bold tracking-[-0.02em] text-balance text-brand-ink">
          Your week, your courses, your CGPA. One app.
        </h2>
        <p className="mt-4 text-[17px] leading-normal text-brand-ink">
          Made by NSU students for every program. Log your classes, track what's left of your degree
          and trade help with other students.
        </p>
        <div className="mt-8">
          <SampleWeek />
        </div>
      </div>
      <p className="text-[13px] leading-[1.4] text-brand-ink">{UNOFFICIAL_TEXT}</p>
    </aside>
  );
}

/**
 * Shared frame for the sign up, log in and change password screens: an optional lead above the
 * title, the fields straight on the ground (no panel around them) and an optional footer, in one
 * column up to 420px wide.
 *
 * With `split`, from `lg` the column sits centered in the space right of `AuthAside` (which
 * `AppLayout` renders beside it). The lead (and the unofficial note) then hide, since the panel
 * carries them. Below `lg` nothing changes.
 *
 * The wordmark is not drawn here. `AppLayout` already shows it above these screens whenever there is
 * no tab bar (signed out, or a temporary password), and the rail carries it from `md` when there are
 * tabs, so a second one would double up.
 */
export function AuthScreen({
  title,
  intro,
  lead,
  footer,
  back,
  split,
  children,
}: {
  title: string;
  intro?: string;
  /** Something of the app's own shown above the title, such as the login screen's sample week. */
  lead?: ReactNode;
  footer?: ReactNode;
  /** A way back to the screen the user came from, for screens opened from another one. */
  back?: { to: "/settings"; label: string };
  /** Centre the column beside the `AuthAside` panel from `lg`. */
  split?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`mx-auto w-full max-w-[420px] space-y-6 md:pt-6 ${split ? "lg:max-w-[400px] lg:pt-0" : ""}`}
    >
      {back ? (
        <Link
          to={back.to}
          className={`-mx-2 inline-flex h-11 items-center gap-1 rounded-control px-2 text-[15px] font-medium text-soft hover:text-ink ${focusRing}`}
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      ) : null}
      {split && lead ? <div className="lg:hidden">{lead}</div> : lead}
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
