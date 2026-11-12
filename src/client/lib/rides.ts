import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { get, set, type FieldErrors, type Resolver } from "react-hook-form";
import { contactReveal } from "../../shared/schemas/common";
import { POST_DEFAULT_EXPIRY_DAYS, POST_RENEW_EXTEND_DAYS } from "../../shared/posts";
import { WEEKDAYS, type Weekday } from "../../shared/rides";
import {
  rideFeedPage,
  rideFeedQuery,
  rideInput,
  ridePatch,
  rideSummary,
  type RideFeedQuery,
  type RideInput,
  type RidePatch,
  type RideSummary,
} from "../../shared/schemas/rides";
import {
  dhakaDate,
  dhakaMinutes,
  dhakaWeekday,
  DHAKA_OFFSET_MS,
  formatDhakaDate,
  parseDhakaDate,
} from "../../shared/time";
import { ApiError, apiGet, apiPatch, apiPost, queryString } from "./api";

type Vehicle = RideSummary["vehicle"];
type Kind = RideSummary["kind"];

export const VEHICLES: readonly Vehicle[] = ["bike", "car", "suv", "bus"];

export const VEHICLE_LABELS: Record<Vehicle, string> = {
  bike: "Bike",
  car: "Car",
  suv: "SUV",
  bus: "Bus",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

export const WEEKDAY_LONG: Record<Weekday, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---- Words ---------------------------------------------------------------------------------------

/** The safety notice, on the feed, the detail and the post form. The platform is not a party to a ride. */
export const RIDE_SAFETY_NOTICE =
  "UniLink doesn't arrange or guarantee rides. Students agree the ride and the payment between themselves.";

/** What happens to a ride and when. Matches the server: a one-off lapses at departure, a recurring ride at the end of its last day. */
export const RIDE_EXPIRY_WORDS = {
  one_off: "A one-off ride disappears from the feed when it departs.",
  recurring: `A recurring ride runs through its end date, then disappears. You can renew it to add ${POST_RENEW_EXTEND_DAYS} days.`,
  deleted: "A deleted ride is gone for everyone right away.",
} as const;

/** Under the end date field. */
export const RIDE_DEFAULT_END_WORDS = `Leave it empty and the ride runs for ${POST_DEFAULT_EXPIRY_DAYS} days.`;

export const RIDE_REPORT_DESCRIPTION =
  "Say what is wrong, such as a ride that isn't real or a post that breaks the rules. Moderators read every report.";

/** "7:30 am" for a 24-hour "HH:MM". */
export function clockLabel(time: string): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "20 Nov" for a "YYYY-MM-DD" Dhaka date. */
export function dayLabel(date: string): string {
  const parsed = parseDhakaDate(date);
  return parsed ? `${parsed.day} ${MONTHS[parsed.month - 1]}` : date;
}

/** "Fri 20 Nov, 7:30 am" in Asia/Dhaka for an instant. */
export function departureLabel(at: number): string {
  const date = dhakaDate(at);
  const minutes = dhakaMinutes(at);
  const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return `${WEEKDAY_SHORT[WEEKDAYS[dhakaWeekday(at)]!]} ${date.day} ${MONTHS[date.month - 1]}, ${clockLabel(time)}`;
}

/** "Every day", "Sun to Thu" for three or more days in a row, or "Mon, Wed". */
export function daysLabel(days: readonly Weekday[]): string {
  const idx = [...new Set(days.map((d) => WEEKDAYS.indexOf(d)))].sort((a, b) => a - b);
  if (idx.length === WEEKDAYS.length) return "Every day";
  const first = idx[0];
  const last = idx[idx.length - 1];
  if (
    first !== undefined &&
    last !== undefined &&
    idx.length >= 3 &&
    last - first === idx.length - 1
  ) {
    return `${WEEKDAY_SHORT[WEEKDAYS[first]!]} to ${WEEKDAY_SHORT[WEEKDAYS[last]!]}`;
  }
  return idx.map((i) => WEEKDAY_SHORT[WEEKDAYS[i]!]).join(", ");
}

type Schedule = Pick<RideSummary, "kind" | "departsAt" | "days" | "departureTime" | "endsOn">;

/** When it leaves: a date and time, or the weekdays and time of day. */
export function scheduleLine(r: Schedule): string {
  if (r.kind === "one_off") return r.departsAt === null ? "" : departureLabel(r.departsAt);
  const days = r.days ? daysLabel(r.days) : "";
  return r.departureTime ? `${days} at ${clockLabel(r.departureTime)}` : days;
}

/** "Runs until 20 Jan" for a recurring ride, empty for a one-off. */
export const runsUntilLine = (r: Pick<RideSummary, "kind" | "endsOn">): string =>
  r.kind === "recurring" && r.endsOn ? `Runs until ${dayLabel(r.endsOn)}` : "";

/** "Full", or "3 of 4 seats left". */
export function seatsLine(r: Pick<RideSummary, "state" | "seatsRemaining" | "totalSeats">): string {
  if (r.state === "full" || r.seatsRemaining === 0) return "Full";
  if (r.totalSeats === 1) return "1 seat left";
  return `${r.seatsRemaining} of ${r.totalSeats} seats left`;
}

/** "Free", or "150 taka a seat". */
export const priceLine = (taka: number): string => (taka === 0 ? "Free" : `${taka} taka a seat`);

/** The label a ride carries on "My rides" when it is anything other than live and open; null otherwise. */
export function rideBadge(
  r: Pick<RideSummary, "status" | "state">,
): "Not approved" | "Waiting for a moderator" | "Ended" | "Full" | null {
  if (r.status === "rejected") return "Not approved";
  if (r.status === "pending_review") return "Waiting for a moderator";
  if (r.state === "expired") return "Ended";
  if (r.state === "full") return "Full";
  return null;
}

// ---- The feed's search params --------------------------------------------------------------------

export type RideSearch = {
  /** "mine" is the poster's own rides; the feed is the default. */
  tab?: "mine";
  q?: string;
  /** Pickup and destination area ids. A top-level area also matches its sub-areas. */
  from?: number;
  to?: number;
  vehicle?: Vehicle;
  date?: string;
  day?: Weekday;
};

/**
 * The route's `validateSearch`: each param is checked with the feed's own shared schema, and one that
 * does not fit (a hand-edited URL) is dropped rather than breaking the page.
 */
export function parseRideSearch(raw: Record<string, unknown>): RideSearch {
  const keep = <T>(r: { success: true; data: T } | { success: false }) =>
    r.success ? r.data : undefined;
  const q = keep(rideFeedQuery.shape.q.safeParse(raw.q));
  return {
    tab: raw.tab === "mine" ? "mine" : undefined,
    q: q ? q : undefined,
    from: keep(rideFeedQuery.shape.from.safeParse(raw.from)),
    to: keep(rideFeedQuery.shape.to.safeParse(raw.to)),
    vehicle: keep(rideFeedQuery.shape.vehicle.safeParse(raw.vehicle)),
    date: keep(rideFeedQuery.shape.date.safeParse(raw.date)),
    day: keep(rideFeedQuery.shape.day.safeParse(raw.day)),
  };
}

export type RideFilters = Pick<RideFeedQuery, "q" | "from" | "to" | "vehicle" | "date" | "day">;

/** The filters in a search, nothing else. */
export const filtersOf = (s: RideSearch): RideFilters => ({
  q: s.q,
  from: s.from,
  to: s.to,
  vehicle: s.vehicle,
  date: s.date,
  day: s.day,
});

/** How many filters are on, for the Filters button. */
export const activeFilterCount = (f: RideFilters): number =>
  [f.q, f.from, f.to, f.vehicle, f.date, f.day].filter(Boolean).length;

// ---- The form ------------------------------------------------------------------------------------

/** What the form holds: strings and the weekday list, as the inputs give them. Turned into a `RideInput` by `rideInputFromFields`. */
export type RideFormFields = {
  kind: Kind;
  /** An area id as the picker gives it: a number as text, empty until picked. */
  pickupAreaId: string;
  destinationAreaId: string;
  pickupLandmark: string;
  destinationLandmark: string;
  vehicle: Vehicle;
  totalSeats: string;
  pricePerSeatTaka: string;
  notes: string;
  contacts: { phone: string; whatsapp: string; messenger: string };
  /** One-off: "YYYY-MM-DDTHH:MM" in Asia/Dhaka, as a datetime-local input gives it. */
  departure: string;
  days: Weekday[];
  departureTime: string;
  /** "YYYY-MM-DD", or empty for the default end. */
  endsOn: string;
};

export const emptyRideFields = (kind: Kind = "one_off"): RideFormFields => ({
  kind,
  pickupAreaId: "",
  destinationAreaId: "",
  pickupLandmark: "",
  destinationLandmark: "",
  vehicle: "car",
  totalSeats: "",
  pricePerSeatTaka: "",
  notes: "",
  contacts: { phone: "", whatsapp: "", messenger: "" },
  departure: "",
  days: [],
  departureTime: "",
  endsOn: "",
});

/** The Dhaka datetime-local string of an instant, "YYYY-MM-DDTHH:MM". */
export function instantToDeparture(at: number): string {
  const minutes = dhakaMinutes(at);
  const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return `${formatDhakaDate(dhakaDate(at))}T${time}`;
}

/** The instant (UTC epoch ms) of a Dhaka "YYYY-MM-DDTHH:MM" string, or undefined when it is not one. */
export function departureToInstant(value: string): number | undefined {
  const m = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  const date = m ? parseDhakaDate(m[1]!) : null;
  if (!m || !date) return undefined;
  return (
    Date.UTC(date.year, date.month - 1, date.day, Number(m[2]), Number(m[3])) - DHAKA_OFFSET_MS
  );
}

/** The form's values for an existing ride and its contacts, for the edit screen. */
export function fieldsFromRide(
  ride: RideSummary,
  contacts: { phone?: string; whatsapp?: string; messenger?: string },
): RideFormFields {
  return {
    kind: ride.kind,
    pickupAreaId: String(ride.pickupArea.id),
    destinationAreaId: String(ride.destinationArea.id),
    pickupLandmark: ride.pickupLandmark ?? "",
    destinationLandmark: ride.destinationLandmark ?? "",
    vehicle: ride.vehicle,
    totalSeats: String(ride.totalSeats),
    pricePerSeatTaka: String(ride.pricePerSeatTaka),
    notes: ride.notes ?? "",
    contacts: {
      phone: contacts.phone ?? "",
      whatsapp: contacts.whatsapp ?? "",
      messenger: contacts.messenger ?? "",
    },
    departure: ride.departsAt === null ? "" : instantToDeparture(ride.departsAt),
    days: ride.days ?? [],
    departureTime: ride.departureTime ?? "",
    endsOn: ride.endsOn ?? "",
  };
}

const number = (value: string): number | undefined => {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
};

/** The form's values in the shape `rideInput` checks. Blank numbers and dates stay absent so the schema, not this, says what is wrong. */
export function rideInputFromFields(f: RideFormFields): unknown {
  const base = {
    pickupAreaId: number(f.pickupAreaId),
    destinationAreaId: number(f.destinationAreaId),
    pickupLandmark: f.pickupLandmark,
    destinationLandmark: f.destinationLandmark,
    vehicle: f.vehicle,
    totalSeats: number(f.totalSeats),
    pricePerSeatTaka: number(f.pricePerSeatTaka),
    notes: f.notes,
    contacts: f.contacts,
  };
  return f.kind === "one_off"
    ? { ...base, kind: "one_off", departsAt: departureToInstant(f.departure) }
    : {
        ...base,
        kind: "recurring",
        // In week order, however they were tapped.
        days: [...f.days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)),
        departureTime: f.departureTime,
        endsOn: f.endsOn.trim() === "" ? undefined : f.endsOn,
      };
}

/** The body of `POST /api/rides`, from the form's values. Throws if they don't pass `rideInput`; the form's resolver has already checked. */
export const rideBodyFromFields = (f: RideFormFields): RideInput =>
  rideInput.parse(rideInputFromFields(f));

/** Where a schema error shows in the form: the departure instant is the `departure` input. */
const FIELD_OF_PATH: Record<string, string> = { departsAt: "departure" };

/** The schema's catch-all message for a blank number or date, said the way the field would. */
const BLANK_MESSAGES: Record<string, string> = {
  pickupAreaId: "Pick a pickup area",
  destinationAreaId: "Pick a destination area",
  totalSeats: "Enter how many seats you can offer",
  pricePerSeatTaka: "Enter the price, or 0 if it's free",
  departure: "Pick the departure date and time",
};

/**
 * The form's resolver. It runs the form's values through the same `rideInput` schema the server uses,
 * so every message is the shared schema's; only a blank number or date, which the schema reports as a
 * type error, gets a plain sentence.
 */
export const rideFormResolver: Resolver<RideFormFields> = (values) => {
  const parsed = rideInput.safeParse(rideInputFromFields(values));
  if (parsed.success) return { values, errors: {} };
  const errors: FieldErrors<RideFormFields> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.map(String);
    path[0] = FIELD_OF_PATH[path[0] ?? ""] ?? path[0] ?? "";
    const key = path.join(".");
    if (get(errors, key)) continue;
    const blank = issue.code === "invalid_type" && BLANK_MESSAGES[key];
    set(errors, key, { type: issue.code, message: blank || issue.message });
  }
  return { values: {}, errors };
};

const trimmed = (f: RideFormFields) => ({
  ...f,
  pickupAreaId: f.pickupAreaId.trim(),
  destinationAreaId: f.destinationAreaId.trim(),
  pickupLandmark: f.pickupLandmark.trim(),
  destinationLandmark: f.destinationLandmark.trim(),
  totalSeats: f.totalSeats.trim(),
  pricePerSeatTaka: f.pricePerSeatTaka.trim(),
  notes: f.notes.trim(),
  contacts: {
    phone: f.contacts.phone.trim(),
    whatsapp: f.contacts.whatsapp.trim(),
    messenger: f.contacts.messenger.trim(),
  },
  endsOn: f.endsOn.trim(),
  days: [...f.days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)),
});

/**
 * The body of `PATCH /api/rides/:id`: only what differs from the ride as it was loaded. Null when
 * nothing changed. The contacts go as one block, because a patch replaces them all. Throws if the
 * values don't pass the shared schemas; the form's resolver has already checked.
 */
export function ridePatchFromFields(
  fields: RideFormFields,
  original: RideFormFields,
): RidePatch | null {
  const next = rideBodyFromFields(fields);
  const now = trimmed(fields);
  const was = trimmed(original);
  const patch: Record<string, unknown> = {};
  if (now.pickupAreaId !== was.pickupAreaId) patch.pickupAreaId = next.pickupAreaId;
  if (now.destinationAreaId !== was.destinationAreaId) {
    patch.destinationAreaId = next.destinationAreaId;
  }
  if (now.pickupLandmark !== was.pickupLandmark) patch.pickupLandmark = next.pickupLandmark ?? null;
  if (now.destinationLandmark !== was.destinationLandmark) {
    patch.destinationLandmark = next.destinationLandmark ?? null;
  }
  if (now.vehicle !== was.vehicle) patch.vehicle = next.vehicle;
  if (now.totalSeats !== was.totalSeats) patch.totalSeats = next.totalSeats;
  if (now.pricePerSeatTaka !== was.pricePerSeatTaka) {
    patch.pricePerSeatTaka = next.pricePerSeatTaka;
  }
  if (now.notes !== was.notes) patch.notes = next.notes ?? null;
  if (JSON.stringify(now.contacts) !== JSON.stringify(was.contacts)) patch.contacts = next.contacts;
  if (next.kind === "one_off") {
    if (now.departure !== was.departure) patch.departsAt = next.departsAt;
  } else {
    if (now.days.join() !== was.days.join()) patch.days = next.days;
    if (now.departureTime !== was.departureTime) patch.departureTime = next.departureTime;
    if (now.endsOn !== was.endsOn && next.endsOn !== undefined) patch.endsOn = next.endsOn;
  }
  return Object.keys(patch).length === 0 ? null : ridePatch.parse(patch);
}

// ---- Queries -------------------------------------------------------------------------------------

/** The feed, filtered. Every ride write invalidates the `rides` prefix. */
export const rideFeedInfinite = (filters: RideFilters) =>
  infiniteQueryOptions({
    queryKey: ["rides", "feed", filtersOf(filters)],
    queryFn: ({ pageParam }) =>
      apiGet(
        `/api/rides${queryString({
          ...filtersOf(filters),
          from: filters.from?.toString(),
          to: filters.to?.toString(),
          cursor: pageParam || undefined,
        })}`,
        rideFeedPage,
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // A changed filter keeps the last list on screen until the new one arrives, so the page doesn't jump.
    placeholderData: keepPreviousData,
  });

/** The signed-in student's own rides, in any status, lapsed ones included. */
export const myRidesInfinite = infiniteQueryOptions({
  queryKey: ["rides", "mine"],
  queryFn: ({ pageParam }) =>
    apiGet(`/api/rides/mine${queryString({ cursor: pageParam || undefined })}`, rideFeedPage),
  initialPageParam: "",
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});

/** One ride. A 404 means it is gone, expired for the viewer, or not theirs to see. */
export const rideDetailQuery = (id: number) =>
  queryOptions({
    queryKey: ["rides", "detail", id],
    queryFn: () => apiGet(`/api/rides/${id}`, rideSummary),
    // A gone ride will not come back, so do not ask again.
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

/**
 * The poster's own contacts, for the edit form. Owner only, not counted against the reveal limit and
 * available after the ride ends. Still dropped as soon as the form closes, so contacts are not kept around.
 */
export const ownContactsQuery = (id: number) =>
  queryOptions({
    // Outside the `rides` prefix, so saving the edit does not refetch it.
    queryKey: ["ride-contacts", id],
    queryFn: () => apiGet(`/api/rides/${id}/own-contact`, contactReveal),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

// ---- Mutations -----------------------------------------------------------------------------------

function useRefreshRides() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["rides"] });
}

export function useCreateRide() {
  const refresh = useRefreshRides();
  return useMutation({
    mutationFn: (input: RideInput) => apiPost("/api/rides", rideSummary, input),
    onSuccess: refresh,
  });
}

export function useUpdateRide(id: number) {
  const refresh = useRefreshRides();
  return useMutation({
    mutationFn: (patch: RidePatch) => apiPatch(`/api/rides/${id}`, rideSummary, patch),
    onSuccess: refresh,
  });
}

export function useSetSeats(id: number) {
  const refresh = useRefreshRides();
  return useMutation({
    mutationFn: (seatsRemaining: number) =>
      apiPost(`/api/rides/${id}/seats`, rideSummary, { seatsRemaining }),
    onSuccess: refresh,
  });
}

export function useMarkFull(id: number) {
  const refresh = useRefreshRides();
  return useMutation({
    mutationFn: () => apiPost(`/api/rides/${id}/full`, rideSummary),
    onSuccess: refresh,
  });
}

export function useRenewRide(id: number) {
  const refresh = useRefreshRides();
  return useMutation({
    mutationFn: () => apiPost(`/api/rides/${id}/renew`, rideSummary),
    onSuccess: refresh,
  });
}
