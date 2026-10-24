import { ArrowRightIcon, CircleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ConfirmRequest } from "@/lib/modConfirm";

/**
 * The step between "Submit" and the request for every mod and admin action. It says what is about to
 * happen (who or what is affected, the reason, a before and after for each edited field, what
 * follows), and only its confirm button sends anything. Cancel, Escape and a drag down send nothing.
 * `useConfirm` (in `lib/useConfirm`) drives it.
 */
const panel = "overflow-hidden rounded-row bg-tint";
const panelRow = "border-t border-line px-4 py-3 first:border-t-0";
const rowLabel = "text-[13px] leading-[1.3] font-medium text-soft";

export function ConfirmSheet({
  request,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  request: ConfirmRequest | null;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Keep the last request on screen while the sheet slides out, so its words don't vanish first.
  const [shown, setShown] = useState(request);
  if (request && request !== shown) setShown(request);

  return (
    <Sheet open={request !== null} onOpenChange={(open) => !open && onCancel()}>
      <SheetContent side="bottom" showCloseButton={false}>
        {shown ? (
          <>
            <SheetHeader>
              <SheetTitle>{shown.title}</SheetTitle>
              <SheetDescription className="text-[15px] text-soft">{shown.lead}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-5">
              {shown.counts ? (
                <dl className={`${panel} grid grid-cols-3`}>
                  {shown.counts.map((c) => (
                    <div key={c.label} className="border-l border-line px-4 py-3 first:border-l-0">
                      <dd className="text-[28px] leading-[1.15] font-bold text-ink tabular-nums">
                        {c.value}
                      </dd>
                      <dt className={rowLabel}>{c.label}</dt>
                    </div>
                  ))}
                </dl>
              ) : null}
              {shown.facts.length > 0 ? (
                <dl className={panel}>
                  {shown.facts.map((f) => (
                    <div key={f.label} className={panelRow}>
                      <dt className={rowLabel}>{f.label}</dt>
                      <dd className="text-[15px] leading-[1.4] break-words whitespace-pre-wrap text-ink">
                        {f.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {shown.changes && shown.changes.length > 0 ? (
                <ul className={panel} aria-label="Changes">
                  {shown.changes.map((c) => (
                    <li key={c.label} className={panelRow}>
                      <p className={rowLabel}>{c.label}</p>
                      <p className="text-[15px] leading-[1.4] break-words text-faint line-through">
                        <span className="sr-only">Was </span>
                        {c.before}
                      </p>
                      <p className="flex items-start gap-2 text-[15px] leading-[1.4] font-medium break-words text-ink">
                        <ArrowRightIcon
                          aria-hidden
                          className="mt-0.5 size-[18px] shrink-0 text-soft"
                        />
                        <span>
                          <span className="sr-only">Now </span>
                          {c.after}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {shown.effects.length > 0 ? (
                <div className="space-y-1.5">
                  <p className={rowLabel}>What happens next</p>
                  <ul className="list-disc space-y-1 pl-5 text-[15px] leading-[1.4] text-ink marker:text-faint">
                    {shown.effects.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {error ? (
                <p
                  role="alert"
                  className="flex items-start gap-3 rounded-row bg-danger-soft px-3.5 py-3 text-[15px] text-ink"
                >
                  <CircleAlertIcon
                    aria-hidden
                    strokeWidth={1.75}
                    className="mt-0.5 size-5 shrink-0 text-danger"
                  />
                  {error}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 px-5 pt-1 pb-1 sm:flex-row sm:justify-end">
              <Button variant="ghost" size="lg" disabled={pending} onClick={onCancel}>
                Cancel
              </Button>
              <Button
                variant={shown.destructive ? "destructive" : "default"}
                size="lg"
                loading={pending}
                onClick={onConfirm}
              >
                {shown.confirmLabel}
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
