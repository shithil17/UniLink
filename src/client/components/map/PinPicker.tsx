import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { flyToPoint } from "@/lib/map/camera";
import { PIN_MARKUP } from "@/lib/map/trip";
import { toast } from "@/lib/toast";
import {
  distanceM,
  NSU_CENTRE,
  PIN_MOVED_MIN_M,
  roundPoint,
  type GeoPoint,
} from "../../../shared/geo";
import { MapOverlay } from "./MapOverlay";

/** What the picker hands to its search slot, so a search result can move the map. */
export type PinPickerControls = {
  /** Moves the map to `point` at street zoom. The pin stays under the student's control. */
  flyTo: (point: GeoPoint) => void;
};

export type PinPickerProps = {
  open: boolean;
  /** Called for every way out. Wire it to `useMapParam().close`. */
  onClose: () => void;
  /** The map's name and the title floating beside the close button, for example "Pin the pickup". */
  label: string;
  /** The saved pin. The map opens on it, and "Remove pin" shows while there is one. */
  point: GeoPoint | null;
  /** Where to open when there is no pin: the chosen area's point. Neither: NSU. */
  fallback: GeoPoint | null;
  /** The spot the student confirmed, rounded to 5 decimals. The picker closes itself afterwards. */
  onConfirm: (point: GeoPoint) => void;
  /** Clears the saved pin. The picker closes itself afterwards. */
  onRemove?: () => void;
  /** Which pin to draw at the centre: the pickup's filled pin or the destination's flag pin. */
  pin?: "pickup" | "destination";
  /** The meeting-spot hint. */
  hint?: string;
  /** Replaces the title with a search field beside the close button. */
  search?: (controls: PinPickerControls) => ReactNode;
};

export const PIN_HINT =
  "Pick a spot where riders can meet you, such as a gate or a bus stand, not your home.";

const STATUS = {
  idle: "Move the map to place the pin",
  moved: "Pin placed. Tap Use this spot to keep it.",
  saved: "Pinned. Move the map to change it.",
} as const;

type Session = { saved: GeoPoint | null; start: GeoPoint | null };

/**
 * A full-screen map for placing one pin. The pin is fixed at the centre and the student moves the map
 * under it, which is easier on a phone than dragging a small marker under a finger. It opens on the
 * saved pin, else on `fallback`, else on NSU. A spot is stored only once the student has moved the
 * map and confirmed it: a pin that was never moved off the area's centre means nothing, so "Use this
 * spot" stays off until then (a saved pin can always be confirmed again). With a keyboard the arrow
 * keys move the map (MapLibre's own handling, with the map focused) and Enter confirms.
 *
 * It knows nothing about rides: the form row, the mod's Areas screen and the search slot are the
 * caller's. Tie `open` to the URL with `useMapParam`.
 */
export function PinPicker({
  open,
  onClose,
  label,
  point,
  fallback,
  onConfirm,
  onRemove,
  pin = "pickup",
  hint = PIN_HINT,
  search,
}: PinPickerProps) {
  // What the picker opened with, fixed while it is open so the map is never moved from under the student.
  const [session, setSession] = useState<Session>({ saved: point, start: point ?? fallback });
  const [wasOpen, setWasOpen] = useState(open);
  const [moved, setMoved] = useState(false);
  const [moving, setMoving] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSession({ saved: point, start: point ?? fallback });
      setMoved(false);
    }
  }

  const [map, setMap] = useState<MapLibreMap | null>(null);
  const focused = useRef(false);
  const latest = useRef({ session, moved, map, onConfirm, onClose });
  useEffect(() => {
    latest.current = { session, moved, map, onConfirm, onClose };
  });

  const handleMap = (map: MapLibreMap) => {
    setMap(map);
    // Without a start the map opens on NSU, and that is the centre it is judged against.
    const origin = latest.current.session.start ?? NSU_CENTRE;
    const onStart = () => setMoving(true);
    const onEnd = () => {
      setMoving(false);
      const c = map.getCenter();
      setMoved(distanceM({ lat: c.lat, lng: c.lng }, origin) > PIN_MOVED_MIN_M);
    };
    map.on("movestart", onStart);
    map.on("moveend", onEnd);
    // The arrow keys move the map only while it has focus, so it starts with it.
    if (!focused.current) {
      focused.current = true;
      map.getCanvas().focus({ preventScroll: true });
    }
    return () => {
      map.off("movestart", onStart);
      map.off("moveend", onEnd);
      setMap(null);
    };
  };

  const canConfirm = moved || session.saved !== null;
  const confirm = () => {
    const { session: s, moved: didMove, map } = latest.current;
    if (!map) return;
    if (!didMove && s.saved === null) {
      toast.error("Move the map to place the pin first.");
      return;
    }
    // A saved pin that was not moved is confirmed as it is, not re-read from the map.
    const c = map.getCenter();
    const spot = didMove || !s.saved ? roundPoint({ lat: c.lat, lng: c.lng }) : s.saved;
    latest.current.onConfirm(spot);
    latest.current.onClose();
  };

  // Enter confirms from anywhere on the map, but not while a field or a button has its own use for it.
  useEffect(() => {
    if (!open) {
      focused.current = false;
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.defaultPrevented) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, button, a")) {
        return;
      }
      event.preventDefault();
      confirm();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // `confirm` reads everything through `latest`, so it never goes stale.
  }, [open]);

  const controls: PinPickerControls = {
    flyTo: (target) => {
      if (map) flyToPoint(map, target);
    },
  };

  const status = moved ? STATUS.moved : session.saved ? STATUS.saved : STATUS.idle;

  return (
    <MapOverlay
      open={open}
      onClose={onClose}
      label={label}
      fitPoints={session.start ? [session.start] : undefined}
      onMap={handleMap}
      footer={
        <div
          data-slot="pin-picker-bar"
          className="grid gap-3 rounded-panel bg-surface p-4 shadow-float md:rounded-[24px]"
        >
          <p className="text-[13px] leading-[1.4] text-soft">{hint}</p>
          <p
            role="status"
            className="min-h-[1.125rem] text-[13px] leading-[1.4] font-semibold text-ink"
          >
            {status}
          </p>
          <div className="flex gap-2">
            {session.saved && onRemove ? (
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  onRemove();
                  onClose();
                }}
              >
                Remove pin
              </Button>
            ) : null}
            <Button className="min-w-0 flex-1" disabled={!canConfirm} onClick={confirm}>
              Use this spot
            </Button>
          </div>
        </div>
      }
    >
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 z-[5] size-0">
        <span className="absolute -top-1 -left-1 size-2 rounded-full bg-ink/25" />
        <span
          className={cn(
            "absolute bottom-0 left-0 block h-11 w-9 -translate-x-1/2 transition-transform duration-150 ease-ui-out motion-reduce:transition-none",
            moving && "-translate-y-1.5",
          )}
          dangerouslySetInnerHTML={{ __html: PIN_MARKUP[pin] }}
        />
      </div>
      <div
        className={cn(
          "pointer-events-none absolute z-10 flex h-11 items-center *:pointer-events-auto",
          "top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] left-[calc(max(0.75rem,env(safe-area-inset-left))+3.25rem)]",
        )}
      >
        {search ? (
          search(controls)
        ) : (
          <p className="max-w-full truncate rounded-full bg-surface px-4 py-3 text-[15px] leading-none font-semibold text-ink shadow-float">
            {label}
          </p>
        )}
      </div>
    </MapOverlay>
  );
}
