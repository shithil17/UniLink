import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  SHEET_PEEK_REM,
  VELOCITY_SAMPLES,
  dragOffset,
  expandedDragOffset,
  isSettled,
  isTap,
  openness,
  peekDragOffset,
  releaseVelocity,
  scrimOpacity,
  shouldCollapse,
  shouldDismiss,
  shouldExpand,
  springStep,
  type DragSample,
  type SpringState,
} from "@/lib/sheetDrag";
import { XIcon } from "lucide-react";

type SheetCollapse = {
  collapsed: boolean;
  /** Set only on a collapsible sheet: dragging it down minimises it to a peek strip instead of closing it. */
  onCollapsedChange: ((collapsed: boolean) => void) | undefined;
};

const SheetCollapseContext = React.createContext<SheetCollapse>({
  collapsed: false,
  onCollapsedChange: undefined,
});

/**
 * `onCollapsedChange` makes a bottom sheet collapsible: dragging it down minimises it to a peek strip
 * at the bottom (handle and title row) instead of dismissing it, and tapping or dragging the strip up
 * opens it again. `collapsed` is controlled. A collapsed sheet is not modal: no scrim, no focus trap,
 * and an outside press (the map behind it) neither closes it nor is blocked by it. Escape and the
 * close button still close it. Without `onCollapsedChange` the sheet is exactly a plain sheet.
 */
function Sheet({
  collapsed = false,
  onCollapsedChange,
  ...props
}: SheetPrimitive.Root.Props & Partial<SheetCollapse>) {
  const collapsible = onCollapsedChange !== undefined;
  const value = React.useMemo(
    () => ({ collapsed: collapsible && collapsed, onCollapsedChange }),
    [collapsible, collapsed, onCollapsedChange],
  );
  const off = collapsible && collapsed;
  return (
    <SheetCollapseContext.Provider value={value}>
      <SheetPrimitive.Root
        data-slot="sheet"
        {...props}
        // Modal is what blocks the page behind (a full-screen backdrop and aria-hidden on it) and
        // what turns an outside press into a dismissal, so a collapsed sheet drops both.
        modal={off ? false : props.modal}
        disablePointerDismissal={off ? true : props.disablePointerDismissal}
      />
    </SheetCollapseContext.Provider>
  );
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

/**
 * Whether sheets stack above a full-screen map (z-70, over the map's z-60). A sheet opened from a map
 * sets it with `raised`; the sheets and pickers opened from inside it inherit it through here.
 */
const SheetLayer = React.createContext(false);

function SheetOverlay({
  className,
  raised,
  collapsed,
  ...props
}: SheetPrimitive.Backdrop.Props & { raised?: boolean; collapsed?: boolean }) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      data-collapsed={collapsed ? "" : undefined}
      className={cn(
        "fixed inset-0 bg-scrim",
        raised ? "z-70" : "z-50",
        // A collapsed sheet shows the page behind it, so the scrim is gone and passes touches through.
        "data-collapsed:pointer-events-none data-collapsed:opacity-0",
        "transition-opacity duration-320 ease-drawer data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:duration-200 motion-reduce:ease-ui-out",
        className,
      )}
      {...props}
    />
  );
}

/** The peek strip's height in px, read from `--sheet-peek` (it includes the bottom safe-area inset). */
function peekHeight(popup: HTMLElement): number {
  const probe = document.createElement("div");
  probe.setAttribute("data-sheet-probe", "");
  probe.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;height:var(--sheet-peek)";
  popup.appendChild(probe);
  const height = probe.offsetHeight;
  probe.remove();
  return height;
}

/** The collapsed strip: handle and title row, plus the bottom inset. The camera frames the ride above it too. */
const SHEET_PEEK = `calc(${SHEET_PEEK_REM}rem + env(safe-area-inset-bottom))`;

type DragCollapse = { collapsed: boolean; onChange: (collapsed: boolean) => void };

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
 *
 * A collapsible sheet (`collapse`) never dismisses by dragging. Open, a drag down follows the finger
 * to the peek and a release past a third of that distance (or a flick) collapses it; collapsed, a tap
 * or a lift past a fifth of the way (or a flick up) opens it. Either way the release hands the
 * dragged offset back to the stylesheet, which eases it into the new resting place (`translate`),
 * so the sheet carries on from where the finger let go.
 */
function useSheetDrag(
  popupRef: React.RefObject<HTMLElement | null>,
  overlayRef: React.RefObject<HTMLElement | null>,
  closeRef: React.RefObject<HTMLElement | null>,
  collapse: DragCollapse | null,
) {
  const drag = React.useRef<{
    pointerId: number;
    startY: number;
    offset: number;
    height: number;
    /** The distance from fully open to the peek; 0 on a sheet that is not collapsible. */
    travel: number;
    /** The furthest the finger has been from where it went down. */
    moved: number;
    reduced: boolean;
    samples: DragSample[];
  } | null>(null);
  const frame = React.useRef(0);
  // Where the sheet last was, so a new drag can pick up a spring that is still settling.
  const shown = React.useRef(0);

  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // What the scrim shows at an offset; set when a drag starts, since it depends on the sheet's size.
  const scrim = React.useRef<(offset: number) => number>(() => 1);

  const paint = (offset: number) => {
    shown.current = offset;
    if (popupRef.current) popupRef.current.style.transform = `translateY(${offset}px)`;
    if (overlayRef.current) overlayRef.current.style.opacity = String(scrim.current(offset));
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

  /** Collapses or opens the sheet: the stylesheet eases it from the dragged offset into its new rest. */
  const commit = (collapsed: boolean) => {
    rest();
    collapse?.onChange(collapsed);
  };

  const settle = (from: SpringState) => {
    let state = from;
    let last = performance.now();
    const tick = (now: number) => {
      state = springStep(state, (now - last) / 1000);
      last = now;
      if (isSettled(state)) {
        rest();
        return;
      }
      paint(state.x);
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
    const height = popup.offsetHeight;
    const travel = collapse ? Math.max(0, height - peekHeight(popup)) : 0;
    scrim.current = collapse
      ? (offset) => openness(offset, travel, collapse.collapsed)
      : (offset) => scrimOpacity(offset, height);
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY - shown.current,
      offset: shown.current,
      height,
      travel,
      moved: 0,
      reduced,
      samples: [{ t: performance.now(), y: shown.current }],
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    const raw = event.clientY - d.startY;
    d.moved = Math.max(d.moved, Math.abs(raw));
    d.offset = !collapse
      ? dragOffset(raw)
      : collapse.collapsed
        ? peekDragOffset(raw, d.travel)
        : expandedDragOffset(raw, d.travel);
    d.samples.push({ t: performance.now(), y: d.offset });
    if (d.samples.length > VELOCITY_SAMPLES) d.samples.shift();
    if (!d.reduced) paint(d.offset);
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    drag.current = null;
    // A closing sample, so a finger held still before lifting reads as slow, not as the old flick.
    const samples = [...d.samples, { t: performance.now(), y: d.offset }];
    const velocity = releaseVelocity(samples);
    if (collapse) {
      const flip = collapse.collapsed
        ? isTap(d.moved) || shouldExpand(d.offset, d.travel, velocity)
        : shouldCollapse(d.offset, d.travel, velocity);
      if (flip) {
        commit(!collapse.collapsed);
        return;
      }
    } else if (shouldDismiss(d.offset, d.height, velocity)) {
      dismiss(d.reduced);
      return;
    }
    if (d.reduced) return;
    // Velocity is px per ms; the spring works in px per s.
    settle({ x: d.offset, v: velocity * 1000 });
  };

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}

/**
 * The grab zone at the top of a bottom sheet: a 40x5 pill in a 28px-tall touch area. It sticks to
 * the top so it stays reachable while a long body scrolls. Decorative for assistive tech, since
 * Escape and the close button already dismiss the sheet (while collapsed it is a button that opens it).
 */
function SheetHandle({
  collapsed,
  onExpand,
  ...props
}: Partial<ReturnType<typeof useSheetDrag>> & {
  /** On a collapsed sheet the handle is the keyboard's way back to the open sheet. */
  collapsed: boolean;
  onExpand: () => void;
}) {
  return (
    <div
      data-slot="sheet-handle"
      className="sticky top-0 z-10 flex h-7 shrink-0 cursor-grab touch-none justify-center bg-popover pt-2 select-none active:cursor-grabbing"
      {...(collapsed
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label": "Expand",
            "aria-expanded": false,
            // Enter acts on press, Space on release, as a native button does.
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") event.preventDefault();
              if (event.key === "Enter") onExpand();
            },
            onKeyUp: (event: React.KeyboardEvent) => {
              if (event.key === " ") onExpand();
            },
          }
        : { "aria-hidden": true })}
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
  raised: raisedProp,
  covered = false,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
  /** Stack above a full-screen map. Sheets opened from inside this one are raised too. */
  raised?: boolean;
  /** Collapsible sheets only: another sheet sits over this one, so while collapsed it slides out of view instead of showing a peek. */
  covered?: boolean;
}) {
  const raised = React.useContext(SheetLayer) || raisedProp === true;
  const { collapsed: sheetCollapsed, onCollapsedChange } = React.useContext(SheetCollapseContext);
  const bottom = side === "bottom";
  const collapsible = bottom && onCollapsedChange !== undefined;
  const collapsed = collapsible && sheetCollapsed;
  const popupRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const dragHandlers = useSheetDrag(
    popupRef,
    overlayRef,
    closeRef,
    collapsible ? { collapsed, onChange: onCollapsedChange } : null,
  );
  const expand = () => {
    onCollapsedChange?.(false);
    // The handle that had focus stops being a button once the sheet is open, so focus moves up to the sheet.
    popupRef.current?.focus({ preventScroll: true });
  };

  // The strip shows the top of the sheet, so a list scrolled down is parked at the top while it is
  // collapsed and put back where it was when it opens. The saved place belongs to one popup element,
  // so a sheet that closes and opens again (a new element) never inherits it.
  const scrolled = React.useRef<{ popup: HTMLElement; top: number } | null>(null);
  React.useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!popup || !collapsible) return;
    if (collapsed) {
      scrolled.current = { popup, top: popup.scrollTop };
      popup.scrollTop = 0;
      // Focus inside the body is about to be hidden with it; keep it on the sheet rather than lose it.
      const focused = document.activeElement;
      if (
        focused &&
        popup.querySelector("[data-slot=sheet-body]")?.contains(focused) &&
        !focused.closest("[data-sheet-strip-action]")
      ) {
        popup.focus({ preventScroll: true });
      }
    } else {
      if (scrolled.current?.popup === popup) popup.scrollTop = scrolled.current.top;
      scrolled.current = null;
    }
  }, [collapsed, collapsible]);

  // Collapsed, the whole strip is the grab zone (handle and title row), so the drag listens on the
  // sheet itself. A press on the close button or a strip action (`data-sheet-strip-action`, such as a
  // back arrow in the title row), or inside a sheet opened from this one, is not a grab.
  const stripHandlers = {
    ...dragHandlers,
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      const target = event.target as Element;
      if (
        !event.currentTarget.contains(target) ||
        target.closest("[data-slot=sheet-close], [data-sheet-strip-action]")
      )
        return;
      dragHandlers.onPointerDown(event);
    },
  };

  return (
    <SheetPortal>
      <SheetOverlay ref={overlayRef} raised={raised} collapsed={collapsed} />
      <SheetPrimitive.Popup
        ref={popupRef}
        data-slot="sheet-content"
        data-side={side}
        data-collapsed={collapsed ? "" : undefined}
        data-covered={collapsed && covered ? "" : undefined}
        inert={collapsed && covered}
        className={cn(
          "group/sheet fixed flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground",
          raised ? "z-70" : "z-50",
          // ceiling: bottom sheets only. Side and top sheets keep the plain border, shadow and fade
          // they had; they have no drag. A side sheet that needs the same would justify extending it.
          bottom
            ? "transition-[translate,opacity] duration-320 ease-drawer motion-safe:data-ending-style:translate-y-[calc(100%+2rem)] motion-safe:data-starting-style:translate-y-[calc(100%+2rem)] motion-reduce:duration-200 motion-reduce:ease-ui-out motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:opacity-0"
            : "border-line shadow-float transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0",
          // Bottom: a flat surface lifted by the up shadow (no border), 28px top corners, and a
          // body that scrolls inside 90% of the screen without chaining the scroll to the page.
          // At md and up it is still a bottom sheet, centered at 32rem.
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:mx-auto data-[side=bottom]:h-auto data-[side=bottom]:max-h-[90dvh] data-[side=bottom]:gap-3 data-[side=bottom]:overflow-y-auto data-[side=bottom]:overscroll-contain data-[side=bottom]:rounded-t-sheet data-[side=bottom]:pb-[max(1.375rem,env(safe-area-inset-bottom))] data-[side=bottom]:shadow-float-up data-[side=bottom]:md:max-w-lg",
          // Collapsible: the rest between open and peek is a `translate` too, and the drag's `transform`
          // eases back to none on release. The peek is `--sheet-peek` tall (handle and title row plus
          // the bottom inset); covered, the sheet leaves the screen. Reduced motion swaps without moving.
          collapsible &&
            "transition-[translate,transform,opacity] motion-reduce:transition-opacity data-collapsed:cursor-pointer data-collapsed:touch-none data-collapsed:overflow-y-hidden! data-collapsed:not-data-covered:not-data-ending-style:translate-y-[calc(100%-var(--sheet-peek))] data-collapsed:data-covered:not-data-ending-style:translate-y-[calc(100%+2rem)]",
          "data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className,
        )}
        style={collapsible ? ({ "--sheet-peek": SHEET_PEEK } as React.CSSProperties) : undefined}
        {...(collapsed ? stripHandlers : null)}
        {...props}
      >
        <SheetLayer.Provider value={raised}>
          {bottom ? (
            <SheetHandle
              collapsed={collapsed}
              onExpand={expand}
              {...(collapsed ? null : dragHandlers)}
            />
          ) : null}
          {collapsible ? (
            // Hidden while collapsed, so nothing below the strip takes focus or a touch. Visibility
            // (not `inert`) lets the title and the strip actions inside it stay visible and live, and
            // it waits out the slide so the body does not vanish while the sheet is still moving.
            // Visibility is inherited, so the strip actions opt back in here (the title does in SheetTitle).
            <div
              data-slot="sheet-body"
              className="contents transition-[visibility] duration-0 group-data-collapsed/sheet:invisible group-data-collapsed/sheet:delay-320 group-data-collapsed/sheet:**:data-sheet-strip-action:visible"
            >
              {children}
            </div>
          ) : (
            children
          )}
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
        </SheetLayer.Provider>
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
        // Collapsed, the title is the strip's one line (and stays visible when the body is hidden).
        "font-heading text-[22px] leading-tight font-bold tracking-[-0.01em] text-ink group-data-collapsed/sheet:visible group-data-collapsed/sheet:line-clamp-1",
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
