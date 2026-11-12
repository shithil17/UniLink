import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, CircleCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { sentLinksLine, timeLeft } from "@/lib/resources";
import type { HelpableResourceRequest } from "../../../shared/schemas/resources";
import { RequestHeading } from "./RequestHeading";

/**
 * Open requests the student can help with, as one flat panel of hairline-separated rows. Each row opens
 * the submit screen. A request is never shown with its requester's name or anyone's link.
 */
export function HelpableList({ items, now }: { items: HelpableResourceRequest[]; now: number }) {
  return (
    <ul className="overflow-hidden rounded-panel bg-surface md:rounded-[24px]">
      {items.map((r) => {
        const left = timeLeft(r.expiresAt, now);
        const sent = sentLinksLine(r.myLinks);
        return (
          <li key={r.id} className="border-t border-line first:border-t-0">
            <Link
              to="/resources/$requestId"
              params={{ requestId: String(r.id) }}
              className={`flex min-h-15 items-center gap-3 px-4 py-3 outline-none hover:bg-tint active:bg-tint ${focusRing} focus-visible:-outline-offset-2 ${press}`}
            >
              <span className="grid min-w-0 flex-1 gap-1.5">
                <RequestHeading request={r} />
                {r.note ? (
                  <span className="line-clamp-2 text-[15px] leading-[1.4] break-words text-ink">
                    {r.note}
                  </span>
                ) : null}
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[1.4] text-soft">
                  {r.sameFaculty ? <Badge variant="soft">Same faculty</Badge> : null}
                  {left ? <span>{left}</span> : null}
                  {sent ? (
                    <span className="inline-flex items-center gap-1">
                      <CircleCheckIcon aria-hidden strokeWidth={1.75} className="size-3.5" />
                      {sent}
                    </span>
                  ) : null}
                </span>
              </span>
              <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-faint" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
