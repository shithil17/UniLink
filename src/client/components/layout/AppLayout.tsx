import { Link } from "@tanstack/react-router";
import { HouseIcon, SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { InstallHint } from "@/components/pwa/InstallHint";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { Toaster } from "@/components/ui/sonner";

const navItems = [
  { to: "/", label: "Home", icon: HouseIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

/** Header plus navigation: a bottom bar on phones, inline in the header from `md` up. */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-app pb-[calc(4rem+env(safe-area-inset-bottom))] text-body md:pb-0">
      <header className="sticky top-0 z-10 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="text-lg font-semibold text-ink">
            UniLink
          </Link>
          <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:static md:border-t-0 md:pb-0"
          >
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs text-soft [&.active]:font-semibold [&.active]:text-brand md:h-10 md:flex-none md:flex-row md:gap-2 md:px-3 md:text-sm"
              >
                <Icon className="size-5 md:size-4" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <InstallHint />
        {children}
      </main>
      <UpdatePrompt />
      <Toaster />
    </div>
  );
}
