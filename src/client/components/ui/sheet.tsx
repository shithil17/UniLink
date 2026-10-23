import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  VELOCITY_SAMPLES,
  dragOffset,
  isSettled,
  releaseVelocity,
  scrimOpacity,
  shouldDismiss,
  springStep,
  type DragSample,
  type SpringState,
} from "@/lib/sheetDrag";
import { XIcon } from "lucide-react";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-scrim transition-opacity duration-320 ease-drawer data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:duration-200 motion-reduce:ease-ui-out",
        className,
      )}
      {...props}
    />
  );
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Drag-to-dismiss for a bottom sheet, driven from its handle zone with pointer events. While the
 * finger is down the sheet follows it with no transition; on release it either closes (past a third
 * of its height, or a quick flick) or settles back on a damped spring. The scrim fades with the
 * distance. Under reduced motion nothing moves: a dismissing drag just closes the sheet.
 *
 * It writes `transform` and `opacity` straight to the elements instead of going through React
 * state, so a drag costs no renders. The slide in and out uses the separate `translate` property,
 * so the two compose: a drag-dismiss continues from where the finger let go.
 */
function useSheetDrag(
  popupRef: React.RefObject<HTMLElement | null>,
  overlayRef: React.RefObject<HTMLElement | null>,
  closeRef: React.RefObject<HTMLElement | null>,
) {
  const drag = React.useRef<{
    pointerId: number;
    startY: number;
    offset: number;
    height: number;
    reduced: boolean;
    samples: DragSample[];
  } | null>(null);
  const frame = React.useRef(0);
  // Where the sheet last was, so a new drag can pick up a spring that is still settling.
  const shown = React.useRef(0);

  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const paint = (offset: number, height: number) => {
    shown.current = offset;
    if (popupRef.current) popupRef.current.style.transform = `translateY(${offset}px)`;
    if (overlayRef.current) overlayRef.current.style.opacity = String(scrimOpacity(offset, height));
  };

  const rest = () => {
    shown.current = 0;
    for (const el of [popupRef.current, overlayRef.current]) {
      if (!el) continue;
      el.style.transform = "";
      el.style.transition = "";
      el.style.opacity = "";
    }
  };

  const dismiss = (reduced: boolean) => {
    if (!reduced) {
      // Hand the exit back to the stylesheet: the sheet keeps its dragged offset and slides on from
      // there, and the scrim eases out from where the drag left it.
      if (popupRef.current) popupRef.current.style.transition = "";
      if (overlayRef.current) {
        overlayRef.current.style.transition = "";
        overlayRef.current.style.opacity = "0";
      }
    }
    closeRef.current?.click();
  };

  const settle = (from: SpringState, height: number) => {
    let state = from;
    let last = performance.now();
    const tick = (now: number) => {
      state = springStep(state, (now - last) / 1000);
      last = now;
      if (isSettled(state)) {
        rest();
        return;
      }
      paint(state.x, height);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (drag.current || !event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const popup = popupRef.current;
    if (!popup) return;
    cancelAnimationFrame(frame.current);
    const reduced = reducedMotion();
    if (!reduced) {
      popup.style.transition = "none";
      if (overlayRef.current) overlayRef.current.style.transition = "none";
    }
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY - shown.current,
      offset: shown.current,
      height: popup.offsetHeight,
      reduced,
      samples: [{ t: performance.now(), y: shown.current }],
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    d.offset = dragOffset(event.clientY - d.startY);
    d.samples.push({ t: performance.now(), y: d.offset });
    if (d.samples.length > VELOCITY_SAMPLES) d.samples.shift();
    if (!d.reduced) paint(d.offset, d.height);
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    drag.current = null;
    // A closing sample, so a finger held still before lifting reads as slow, not as the old flick.
    const samples = [...d.samples, { t: performance.now(), y: d.offset }];
    const velocity = releaseVelocity(samples);
    if (shouldDismiss(d.offset, d.height, velocity)) {
      dismiss(d.reduced);
      return;
    }
    if (d.reduced) return;
    // Velocity is px per ms; the spring works in px per s.
    settle({ x: d.offset, v: velocity * 1000 }, d.height);
  };

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}

/**
 * The grab zone at the top of a bottom sheet: a 40x5 pill in a 28px-tall touch area. It sticks to
 * the top so it stays reachable while a long body scrolls. Decorative for assistive tech, since
 * Escape and the close button already dismiss the sheet.
 */
function SheetHandle(props: ReturnType<typeof useSheetDrag>) {
  return (
    <div
      data-slot="sheet-handle"
      aria-hidden
      className="sticky top-0 z-10 flex h-7 shrink-0 cursor-grab touch-none justify-center bg-popover pt-2 select-none active:cursor-grabbing"
      {...props}
    >
      <span className="block h-[5px] w-10 rounded-full bg-edge/55" />
    </div>
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  const popupRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const dragHandlers = useSheetDrag(popupRef, overlayRef, closeRef);
  const bottom = side === "bottom";

  return (
    <SheetPortal>
      <SheetOverlay ref={overlayRef} />
      <SheetPrimitive.Popup
        ref={popupRef}
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "group/sheet fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground",
          // ceiling: bottom sheets only. Side and top sheets keep the plain border, shadow and fade
          // they had; they have no drag. A side sheet that needs the same would justify extending it.
          bottom
            ? "transition-[translate,opacity] duration-320 ease-drawer motion-safe:data-ending-style:translate-y-[calc(100%+2rem)] motion-safe:data-starting-style:translate-y-[calc(100%+2rem)] motion-reduce:duration-200 motion-reduce:ease-ui-out motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:opacity-0"
            : "border-line shadow-float transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0",
          // Bottom: a flat surface lifted by the up shadow (no border), 28px top corners, and a
          // body that scrolls inside 90% of the screen without chaining the scroll to the page.
          // At md and up it is still a bottom sheet, centered at 32rem.
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:mx-auto data-[side=bottom]:h-auto data-[side=bottom]:max-h-[90dvh] data-[side=bottom]:gap-3 data-[side=bottom]:overflow-y-auto data-[side=bottom]:overscroll-contain data-[side=bottom]:rounded-t-sheet data-[side=bottom]:pb-[max(1.375rem,env(safe-area-inset-bottom))] data-[side=bottom]:shadow-float-up data-[side=bottom]:md:max-w-lg",
          "data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className,
        )}
        {...props}
      >
        {bottom ? <SheetHandle {...dragHandlers} /> : null}
        {children}
        {bottom ? (
          // The drag dismisses through the real close path (onOpenChange, focus return), so it
          // clicks this instead of reaching into the dialog's state. Never visible or focusable.
          <SheetPrimitive.Close
            ref={closeRef}
            aria-hidden
            tabIndex={-1}
            className="hidden"
            data-slot="sheet-drag-close"
          />
        ) : null}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button variant="ghost" className="absolute top-3 right-3 z-20" size="icon-sm" />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex flex-col gap-1 px-5 pt-5 pr-16 pb-3 group-data-[side=bottom]/sheet:pt-0",
        className,
      )}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-5", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-[22px] leading-tight font-bold tracking-[-0.01em] text-ink",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
