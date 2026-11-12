import { toast } from "@/lib/toast";
import type { AccountBannedResponse } from "../../../shared/schemas/auth";
import { BannedDetails } from "./BannedNotice";

/**
 * The suspended-account toast. It stays until dismissed, because the reason and the address are
 * worth copying, and carries its own Dismiss button since a swipe is not discoverable. The form
 * also keeps the same text inline, so this is never the only place the message lives.
 */
export function showBannedToast(ban: AccountBannedResponse) {
  const id = toast.error(ban.message, {
    id: "account-banned",
    className: "cn-toast-wide",
    duration: Infinity,
    description: (
      <span className="mt-1 block space-y-1">
        <BannedDetails
          ban={ban}
          linkClassName="rounded-control focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-app"
        />
        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          className="-ml-2 mt-1 inline-flex h-11 items-center rounded-control px-2 text-[15px] font-semibold underline underline-offset-[3px] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-app"
        >
          Dismiss
        </button>
      </span>
    ),
  });
}
