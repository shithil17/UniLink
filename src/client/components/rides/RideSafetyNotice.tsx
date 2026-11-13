import { InfoIcon } from "lucide-react";
import { RIDE_SAFETY_NOTICE } from "@/lib/rides";

/** The quiet line that says the platform does not arrange or guarantee rides. One copy for the feed, the detail and the form. */
export function RideSafetyNotice() {
  return (
    <p className="flex items-start gap-2 text-[13px] leading-[1.4] text-soft">
      <InfoIcon aria-hidden strokeWidth={1.75} className="mt-px size-[18px] shrink-0 text-faint" />
      <span>{RIDE_SAFETY_NOTICE}</span>
    </p>
  );
}
