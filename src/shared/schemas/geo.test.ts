import { describe, expect, it } from "vite-plus/test";
import { MAP_BOUNDS } from "../geo";
import { geoPoint } from "./geo";
import { rideInput, ridePatch } from "./rides";

const NSU = { lat: 23.8151, lng: 90.4253 };

describe("geoPoint", () => {
  it("rounds to 5 decimals", () => {
    expect(geoPoint.parse({ lat: 23.8151234, lng: 90.4253449 })).toEqual({
      lat: 23.81512,
      lng: 90.42534,
    });
    expect(geoPoint.parse({ lat: 23.815125, lng: 90.4253 })).toEqual({
      lat: 23.81513,
      lng: 90.4253,
    });
  });

  it("accepts the edges of the box and nothing past them", () => {
    expect(geoPoint.safeParse({ lat: MAP_BOUNDS.south, lng: MAP_BOUNDS.west }).success).toBe(true);
    expect(geoPoint.safeParse({ lat: MAP_BOUNDS.north, lng: MAP_BOUNDS.east }).success).toBe(true);
    expect(geoPoint.safeParse({ lat: MAP_BOUNDS.south - 0.001, lng: 90.4 }).success).toBe(false);
    expect(geoPoint.safeParse({ lat: MAP_BOUNDS.north + 0.001, lng: 90.4 }).success).toBe(false);
    expect(geoPoint.safeParse({ lat: 23.8, lng: MAP_BOUNDS.west - 0.001 }).success).toBe(false);
    expect(geoPoint.safeParse({ lat: 23.8, lng: MAP_BOUNDS.east + 0.001 }).success).toBe(false);
  });

  it("refuses half a point, text, NaN and infinity", () => {
    for (const bad of [
      { lat: 23.8 },
      { lng: 90.4 },
      { lat: "23.8", lng: "90.4" },
      { lat: Number.NaN, lng: 90.4 },
      { lat: Infinity, lng: 90.4 },
      null,
      {},
    ]) {
      expect(geoPoint.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("points in the ride schemas", () => {
  const ride = {
    kind: "one_off",
    pickupAreaId: 1,
    destinationAreaId: 2,
    vehicle: "car",
    totalSeats: 3,
    pricePerSeatTaka: 100,
    contacts: { phone: "+8801712345678" },
    departsAt: 1_900_000_000_000,
  };

  it("lets a new ride leave either point out and rounds the ones it has", () => {
    expect(rideInput.parse(ride)).not.toHaveProperty("pickupPoint");
    const parsed = rideInput.parse({ ...ride, pickupPoint: { lat: 23.8151234, lng: 90.4253 } });
    expect(parsed.pickupPoint).toEqual({ lat: 23.81512, lng: 90.4253 });
    expect(rideInput.safeParse({ ...ride, destinationPoint: { lat: 1, lng: 1 } }).success).toBe(
      false,
    );
    expect(rideInput.safeParse({ ...ride, destinationPoint: null }).success).toBe(false);
  });

  it("lets an edit set a point or clear it with null, and a clear alone is a change", () => {
    expect(ridePatch.parse({ pickupPoint: NSU }).pickupPoint).toEqual(NSU);
    expect(ridePatch.parse({ pickupPoint: null })).toEqual({ pickupPoint: null });
    expect(ridePatch.safeParse({ destinationPoint: { lat: 23.8 } }).success).toBe(false);
    expect(ridePatch.safeParse({ destinationPoint: { lat: 10, lng: 10 } }).success).toBe(false);
  });
});
