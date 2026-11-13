import { LockKeyholeIcon, MessageCircleIcon, MessageSquareIcon, PhoneIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError, errorMessage } from "@/lib/api";
import { contactActions, type ContactAction } from "@/lib/contactLinks";
import { useRevealContact } from "@/lib/posts";
import { toast } from "@/lib/toast";
import type { ContactKind } from "../../../shared/contact";

const ICONS: Record<ContactKind, typeof PhoneIcon> = {
  phone: PhoneIcon,
  whatsapp: MessageCircleIcon,
  messenger: MessageSquareIcon,
};

/** What the toast says when the reveal limit is hit, or when the ride can no longer be opened. */
function revealFailure(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    return "You've opened a lot of contacts. Wait a while, then try again.";
  }
  if (err instanceof ApiError && err.status === 404) return "This ride is no longer available.";
  return errorMessage(err);
}

function ContactLink({ action }: { action: ContactAction }) {
  const Icon = ICONS[action.kind];
  // A phone number opens the dialer here; WhatsApp and Messenger open their own app or page.
  const external = action.kind !== "phone";
  return (
    <a
      href={action.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={buttonVariants({ variant: "outline", className: "w-full justify-start" })}
    >
      <Icon aria-hidden strokeWidth={1.75} />
      <span>{action.label}</span>
      <span className="ml-auto min-w-0 truncate text-[13px] font-normal text-soft">
        {action.display}
      </span>
    </a>
  );
}

/**
 * Contacts stay hidden until the student taps "Show contact". Each tap is one counted, rate-limited
 * request; once shown, they are real links (`tel:`, `wa.me`, `m.me` or Facebook).
 */
export function RideContact({ rideId }: { rideId: number }) {
  const reveal = useRevealContact("/api/rides");
  const actions = reveal.data ? contactActions(reveal.data.contacts) : null;

  return (
    <section
      aria-label="Contact"
      className="grid gap-3 rounded-panel bg-surface p-4 md:rounded-[24px]"
    >
      {actions ? (
        <ul className="grid gap-2">
          {actions.map((action) => (
            <li key={action.kind}>
              <ContactLink action={action} />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="flex items-start gap-2 text-[13px] leading-[1.4] text-soft">
            <LockKeyholeIcon
              aria-hidden
              strokeWidth={1.75}
              className="mt-px size-[18px] shrink-0 text-faint"
            />
            The poster's contact stays hidden until you ask for it. Opening many in a short time is
            limited.
          </p>
          <Button
            loading={reveal.isPending}
            onClick={() =>
              reveal.mutate(rideId, { onError: (err) => toast.error(revealFailure(err)) })
            }
          >
            Show contact
          </Button>
        </>
      )}
    </section>
  );
}
