import type { ReactNode } from "react";

/** Shared frame for the sign up, log in and change password screens. */
export function AuthScreen({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-sm space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {intro ? <p className="text-sm text-soft">{intro}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** A server error shown above the submit button. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-line bg-surface p-3 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
