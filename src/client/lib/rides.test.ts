import { describe, expect, it } from "vite-plus/test";
import { ridePatch, type RideSummary } from "../../shared/schemas/rides";
import {
  activeFilterCount,
  clockLabel,
  daysLabel,
  departureLabel,
  departureToInstant,
  emptyRideFields,
  fieldsFromRide,
  filtersOf,
  instantToDeparture,
  parseRideSearch,
  priceLine,
  rideBadge,
  rideBodyFromFields,
  rideFormResolver,
  ridePatchFromFields,
  runsUntilLine,
  scheduleLine,
  seatsLine,
  type RideFormFields,
} from "./rides";

// 20 Nov 2026 is a Friday; 01:30 UTC is 07:30 in Dhaka.
const FRI_0730 = Date.UTC(2026, 10, 20, 1, 30);

const ride = (over: Partial<RideSummary> = {}): RideSummary => ({
  id: 1,
  kind: "one_off",
  pickupArea: { id: 1, name: "Bashundhara R/A" },
  destinationArea: { id: 60, name: "Mirpur" },
  pickupLandmark: "NSU gate",
  destinationLandmark: "Mirpur 10",
  vehicle: "car",
  totalSeats: 4,
  seatsRemaining: 3,
  pricePerSeatTaka: 150,
  notes: null,
  departsAt: FRI_0730,
  days: null,
  departureTime: null,
  endsOn: null,
  state: "open",
  status: "published",
  expiresAt: FRI_0730,
  createdAt: FRI_0730 - 1000,
  mine: true,
  ...over,
});

const recurring = (over: Partial<RideSummary> = {}) =>
  ride({
    kind: "recurring",
    departsAt: null,
    days: ["sun", "mon", "tue", "wed", "thu"],
    departureTime: "07:30",
    endsOn: "2027-01-19",
    ...over,
  });

const phone = "+8801712345678";

const filled = (over: Partial<RideFormFields> = {}): RideFormFields => ({
  ...emptyRideFields("one_off"),
  pickupAreaId: "1",
  destinationAreaId: "60",
  pickupLandmark: "NSU gate",
  destinationLandmark: "Mirpur 10",
  totalSeats: "3",
  pricePerSeatTaka: "100",
  departure: instantToDeparture(Date.now() + 3 * 86_400_000),
  contacts: { phone, whatsapp: "", messenger: "" },
  ...over,
});

describe("schedule words", () => {
  it("formats a clock time and a one-off departure in Asia/Dhaka", () => {
    expect(clockLabel("07:30")).toBe("7:30 am");
    expect(clockLabel("00:05")).toBe("12:05 am");
    expect(clockLabel("12:00")).toBe("12:00 pm");
    expect(clockLabel("18:45")).toBe("6:45 pm");
    expect(departureLabel(FRI_0730)).toBe("Fri 20 Nov, 7:30 am");
  });

  it("names weekdays: every day, a run of three or more, or a list", () => {
    expect(daysLabel(["sun", "mon", "tue", "wed", "thu", "fri", "sat"])).toBe("Every day");
    expect(daysLabel(["thu", "sun", "mon", "tue", "wed"])).toBe("Sun to Thu");
    expect(daysLabel(["mon", "wed"])).toBe("Mon, Wed");
    expect(daysLabel(["sun", "mon"])).toBe("Sun, Mon");
  });

  it("describes both kinds of ride", () => {
    expect(scheduleLine(ride())).toBe("Fri 20 Nov, 7:30 am");
    expect(scheduleLine(recurring())).toBe("Sun to Thu at 7:30 am");
    expect(runsUntilLine(recurring())).toBe("Runs until 19 Jan");
    expect(runsUntilLine(ride())).toBe("");
  });

  it("says seats, price and which badge a ride carries", () => {
    expect(seatsLine(ride())).toBe("3 of 4 seats left");
    expect(seatsLine(ride({ totalSeats: 1, seatsRemaining: 1 }))).toBe("1 seat left");
    expect(seatsLine(ride({ state: "full", seatsRemaining: 0 }))).toBe("Full");
    expect(priceLine(0)).toBe("Free");
    expect(priceLine(150)).toBe("150 taka a seat");
    expect(rideBadge(ride())).toBeNull();
    expect(rideBadge(ride({ state: "full" }))).toBe("Full");
    expect(rideBadge(ride({ state: "expired" }))).toBe("Ended");
    expect(rideBadge(ride({ status: "pending_review" }))).toBe("Waiting for a moderator");
    expect(rideBadge(ride({ status: "rejected", state: "expired" }))).toBe("Not approved");
  });
});

describe("departure inputs", () => {
  it("round-trips a Dhaka datetime-local value and refuses junk", () => {
    expect(instantToDeparture(FRI_0730)).toBe("2026-11-20T07:30");
    expect(departureToInstant("2026-11-20T07:30")).toBe(FRI_0730);
    expect(departureToInstant("")).toBeUndefined();
    expect(departureToInstant("2026-02-31T07:30")).toBeUndefined();
  });
});

describe("search params", () => {
  it("keeps valid params and drops the ones that do not fit", () => {
    expect(
      parseRideSearch({
        tab: "mine",
        q: " gate ",
        from: 1,
        to: "60",
        vehicle: "bike",
        date: "2026-11-20",
        day: "mon",
      }),
    ).toEqual({
      tab: "mine",
      q: "gate",
      from: 1,
      to: 60,
      vehicle: "bike",
      date: "2026-11-20",
      day: "mon",
    });
    expect(
      parseRideSearch({
        tab: "x",
        from: "mirpur",
        to: 0,
        vehicle: "boat",
        date: "2026-02-31",
        day: "monday",
      }),
    ).toEqual({
      tab: undefined,
      q: undefined,
      from: undefined,
      to: undefined,
      vehicle: undefined,
      date: undefined,
      day: undefined,
    });
  });

  it("round-trips the area filters through the search and the filters", () => {
    const search = parseRideSearch({ from: 1, to: 60, vehicle: "car" });
    expect(filtersOf(search)).toEqual({
      q: undefined,
      from: 1,
      to: 60,
      vehicle: "car",
      date: undefined,
      day: undefined,
    });
    // What the router writes back to the URL reads the same.
    expect(parseRideSearch({ ...search })).toEqual(search);
  });

  it("counts the filters that are on", () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ q: "gate", vehicle: "car" })).toBe(2);
    expect(activeFilterCount({ from: 1, to: 60 })).toBe(2);
  });
});

describe("the form's values and the shared schema", () => {
  it("builds a one-off body, with blank notes absent and the departure as a UTC instant", () => {
    const fields = filled({ departure: "2099-11-20T07:30" });
    const body = rideBodyFromFields(fields);
    expect(body).toMatchObject({ kind: "one_off", totalSeats: 3, pricePerSeatTaka: 100 });
    if (body.kind !== "one_off") throw new Error("kind");
    expect(body.departsAt).toBe(departureToInstant("2099-11-20T07:30"));
    expect(body.notes).toBeUndefined();
  });

  it("builds a recurring body and leaves the end date out when blank", () => {
    const body = rideBodyFromFields(
      filled({ kind: "recurring", days: ["sun", "tue"], departureTime: "07:30" }),
    );
    expect(body).toMatchObject({ kind: "recurring", days: ["sun", "tue"], departureTime: "07:30" });
    expect("endsOn" in body && body.endsOn).toBeFalsy();
  });

  it("reports what is missing with the schema's words, and plain words for blank numbers and dates", async () => {
    const run = async (f: RideFormFields) =>
      (await rideFormResolver(f, undefined, { fields: {}, shouldUseNativeValidation: false }))
        .errors as Record<string, { message?: string } | undefined>;

    const oneOff = await run(
      filled({ departure: "", totalSeats: "", pricePerSeatTaka: "", pickupAreaId: "" }),
    );
    expect(oneOff.departure?.message).toBe("Pick the departure date and time");
    expect(oneOff.totalSeats?.message).toBe("Enter how many seats you can offer");
    expect(oneOff.pricePerSeatTaka?.message).toBe("Enter the price, or 0 if it's free");
    expect(oneOff.pickupAreaId?.message).toBe("Pick a pickup area");

    const weekly = await run(filled({ kind: "recurring", days: [], departureTime: "" }));
    expect(weekly.days?.message).toBe("Pick at least one day");
    expect(weekly.departureTime?.message).toBe("Pick a time");

    const noContact = await run(filled({ contacts: { phone: "", whatsapp: "", messenger: "" } }));
    expect(
      (noContact.contacts as { phone?: { message?: string } } | undefined)?.phone?.message,
    ).toBe("Add at least one way to reach you");
  });

  it("lists the errors top to bottom as the form lays them out, so the first is the field that is focused", async () => {
    const result = await rideFormResolver(
      filled({
        departure: "",
        contacts: { phone: "", whatsapp: "", messenger: "" },
        pricePerSeatTaka: "",
      }),
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    // The schema checks the contacts before the departure; the form shows the departure first.
    expect(Object.keys(result.errors)).toEqual(["pricePerSeatTaka", "departure", "contacts"]);
  });

  it("accepts a complete form", async () => {
    const result = await rideFormResolver(filled(), undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(result.errors).toEqual({});
  });
});

describe("ridePatchFromFields", () => {
  const contacts = { phone };

  it("is null when nothing changed", () => {
    const original = fieldsFromRide(ride(), contacts);
    expect(ridePatchFromFields({ ...original }, original)).toBeNull();
  });

  it("sends only what changed, notes cleared as null, and all contacts as one block", () => {
    const original = fieldsFromRide(ride({ notes: "Back seat" }), contacts);
    const patch = ridePatchFromFields(
      {
        ...original,
        pricePerSeatTaka: "120",
        notes: "  ",
        contacts: { ...original.contacts, whatsapp: "https://wa.me/8801712345678" },
      },
      original,
    );
    expect(patch).toEqual({
      pricePerSeatTaka: 120,
      notes: null,
      contacts: { phone, whatsapp: "https://wa.me/8801712345678", messenger: undefined },
    });
    expect(ridePatch.safeParse(patch).success).toBe(true);
  });

  it("sends a recurring ride's schedule fields, never a one-off's departure", () => {
    const original = fieldsFromRide(recurring(), contacts);
    const patch = ridePatchFromFields(
      { ...original, days: ["mon", "sun"], departureTime: "08:00" },
      original,
    );
    expect(patch).toEqual({ days: ["sun", "mon"], departureTime: "08:00" });
    expect(patch).not.toHaveProperty("departsAt");
  });

  it("does not resend a departure that is only the unchanged minute-truncated value", () => {
    const original = fieldsFromRide(ride({ departsAt: FRI_0730 + 20_000 }), contacts);
    expect(ridePatchFromFields({ ...original, pickupLandmark: "North gate" }, original)).toEqual({
      pickupLandmark: "North gate",
    });
  });
});
