import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "cn";
import { areaMatches, areasQuery } from "@/lib/areas";
import { usePlaceSearch } from "@/lib/places";
import { toast } from "@/lib/toast";
import { useQuery } from "@tanstack/react-query";
import type { GeoPoint } from "../../../shared/geo";
import { PLACE_AREA_MATCHES_MAX } from "../../../shared/schemas/places";
import type { PinPickerControls } from "./PinPicker";

export const PLACE_SEARCH_UNAVAILABLE =
  "Place search is unavailable. Move the map to place the pin.";

type Item = {
  key: string;
  kind: "area" | "place";
  name: string;
  detail: string;
  point: GeoPoint;
};

/**
 * The search field of the pin picker. One box, one list: our own areas that match come first and are
 * matched in the browser with no request; under them come named places from `GET /api/places/search`,
 * asked for after a pause in typing and only once the text is long enough. The list opens over the
 * map and never moves it. When the place search is down the areas show alone and a toast says so,
 * once until a search works again. Picking a row moves the map there at street zoom and leaves the
 * pin under the student's control; a picked place (not an area) is also reported to `onPlace` so the
 * form can offer its name as the landmark.
 */
export function PlaceSearch({
  controls,
  onPlace,
}: {
  controls: PinPickerControls;
  /** A place (not an area) was picked. */
  onPlace?: (name: string) => void;
}) {
  const areas = useQuery(areasQuery);
  // What is shown in the box, and the text the searches answer. A picked row fills the box with its
  // name but clears the search text, so picking never starts another search.
  const [value, setValue] = useState("");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;

  const search = usePlaceSearch(text);
  const items: Item[] = [
    ...areaMatches(areas.data, text, PLACE_AREA_MATCHES_MAX).map((a): Item => ({
      key: `area-${a.id}`,
      kind: "area",
      name: a.name,
      detail: a.parentName ? `in ${a.parentName}` : "Area",
      point: a.point,
    })),
    ...search.places.map((p, i): Item => ({
      key: `place-${i}`,
      kind: "place",
      name: p.name,
      detail: p.detail,
      point: { lat: p.lat, lng: p.lng },
    })),
  ];
  const areaItems = items.filter((i) => i.kind === "area");
  const placeItems = items.filter((i) => i.kind === "place");
  const status =
    search.places.length > 0
      ? null
      : search.pending
        ? "Searching places"
        : search.answered
          ? "No places found"
          : null;
  const visible = open && (items.length > 0 || status !== null);
  const activeIndex = items.findIndex((i) => i.key === activeKey);
  const activeId = visible && activeIndex >= 0 ? `${baseId}-${items[activeIndex]!.key}` : undefined;

  // One toast for a run of failures, not one per keystroke; a search that works again re-arms it.
  const toasted = useRef(false);
  useEffect(() => {
    if (search.failed) {
      if (!toasted.current) {
        toasted.current = true;
        toast.error(PLACE_SEARCH_UNAVAILABLE);
      }
    } else if (search.answered) {
      toasted.current = false;
    }
  }, [search.failed, search.answered]);

  const pick = (item: Item) => {
    setValue(item.name);
    setText("");
    setOpen(false);
    setActiveKey(null);
    inputRef.current?.blur();
    controls.flyTo(item.point);
    if (item.kind === "place") onPlace?.(item.name);
  };

  const move = (step: 1 | -1) => {
    if (items.length === 0) return;
    const next =
      activeIndex < 0
        ? step === 1
          ? 0
          : items.length - 1
        : (activeIndex + step + items.length) % items.length;
    setActiveKey(items[next]!.key);
    setOpen(true);
    document.getElementById(`${baseId}-${items[next]!.key}`)?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && visible) {
      event.preventDefault();
      const item = activeIndex >= 0 ? items[activeIndex] : items[0];
      if (item) pick(item);
    } else if (event.key === "Escape" && visible) {
      // Close the list only: the map stays open until Escape is pressed again.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setActiveKey(null);
    }
  };

  const row = (item: Item) => {
    const active = item.key === activeKey;
    return (
      <div
        key={item.key}
        id={`${baseId}-${item.key}`}
        role="option"
        aria-selected={active}
        // Keep focus in the field, so the list stays open until the click lands.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => pick(item)}
        className={cn(
          "flex min-h-12 cursor-pointer flex-col justify-center px-4 py-2 text-left",
          active && "bg-brand-soft",
        )}
      >
        <span className="truncate text-[15px] leading-[1.3] font-semibold text-ink">
          {item.name}
        </span>
        {item.detail ? (
          <span className="truncate text-[13px] leading-[1.3] text-soft">{item.detail}</span>
        ) : null}
      </div>
    );
  };

  const group = (label: string, rows: Item[]) =>
    rows.length === 0 ? null : (
      <div
        role="group"
        aria-label={label}
        className="[&>[role=option]+[role=option]]:border-t [&>[role=option]+[role=option]]:border-line"
      >
        <p aria-hidden className="px-4 pt-3 pb-1 text-[12px] leading-none font-semibold text-faint">
          {label}
        </p>
        {rows.map(row)}
      </div>
    );

  return (
    <div
      className="relative w-full max-w-[28rem]"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="relative flex h-11 items-center rounded-full bg-surface shadow-float focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-solid focus-within:outline-brand">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute left-3.5 size-[18px] text-faint"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search for a place or area"
          aria-autocomplete="list"
          aria-expanded={visible}
          aria-controls={visible ? listId : undefined}
          aria-activedescendant={activeId}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Search a place or area"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 rounded-full bg-transparent pr-11 pl-10 text-base text-ink outline-none placeholder:text-faint"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear the search"
            onClick={() => {
              setValue("");
              setText("");
              setActiveKey(null);
              inputRef.current?.focus();
            }}
            className="absolute right-0 flex size-11 items-center justify-center rounded-full text-soft outline-none focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-brand"
          >
            <XIcon aria-hidden className="size-[18px]" />
          </button>
        ) : null}
      </div>
      {visible ? (
        <div className="absolute inset-x-0 top-full mt-2 max-h-[min(22rem,calc(100dvh-9rem))] overflow-y-auto overscroll-contain rounded-panel bg-surface shadow-float">
          {items.length > 0 ? (
            <div
              role="listbox"
              id={listId}
              aria-label="Places and areas"
              className="divide-y divide-line pb-1"
            >
              {group("Areas", areaItems)}
              {group("Places", placeItems)}
            </div>
          ) : null}
          {status ? (
            <p
              role="status"
              className={cn(
                "px-4 py-3 text-[13px] leading-[1.4] text-soft",
                items.length > 0 && "border-t border-line",
              )}
            >
              {status}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
