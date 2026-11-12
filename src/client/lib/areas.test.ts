import { describe, expect, it } from "vite-plus/test";
import type { AreaOption, ModArea } from "../../shared/schemas/areas";
import { areaMatches, areaNameOf, areaRows, groupAreas, placeLine } from "./areas";

const options: AreaOption[] = [
  { id: 1, slug: "bashundhara-r-a", name: "Bashundhara R/A", lat: null, lng: null, children: [] },
  {
    id: 2,
    slug: "mirpur",
    name: "Mirpur",
    lat: null,
    lng: null,
    children: [
      { id: 20, slug: "mirpur-mirpur-10", name: "Mirpur 10", lat: null, lng: null },
      { id: 21, slug: "mirpur-pallabi", name: "Pallabi", lat: null, lng: null },
    ],
  },
  { id: 3, slug: "uttara", name: "Uttara", lat: null, lng: null, children: [] },
];

describe("areaRows", () => {
  it("lists every area with its sub-areas under it when nothing is typed", () => {
    expect(areaRows(options, "  ").map((r) => r.name)).toEqual([
      "Bashundhara R/A",
      "Mirpur",
      "Mirpur 10",
      "Pallabi",
      "Uttara",
    ]);
  });

  it("matches names in any case and keeps every sub-area of a matching area", () => {
    expect(areaRows(options, "MIRPUR").map((r) => r.id)).toEqual([2, 20, 21]);
    expect(areaRows(options, "bashun").map((r) => r.id)).toEqual([1]);
  });

  it("keeps the parent of a sub-area that matches alone, and only the matching sub-areas", () => {
    const rows = areaRows(options, "palla");
    expect(rows).toEqual([
      { id: 2, name: "Mirpur", parentName: null },
      { id: 21, name: "Pallabi", parentName: "Mirpur" },
    ]);
  });

  it("is empty when nothing matches", () => {
    expect(areaRows(options, "zzz")).toEqual([]);
  });
});

describe("areaNameOf and placeLine", () => {
  it("finds a top-level area or a sub-area, and nothing for an id that is not listed", () => {
    expect(areaNameOf(options, 3)).toBe("Uttara");
    expect(areaNameOf(options, 21)).toBe("Pallabi");
    expect(areaNameOf(options, 99)).toBeUndefined();
    expect(areaNameOf(undefined, 1)).toBeUndefined();
  });

  it("puts the landmark in brackets after the area", () => {
    expect(placeLine("Mirpur", "Mirpur 10 circle")).toBe("Mirpur (Mirpur 10 circle)");
    expect(placeLine("Mirpur", null)).toBe("Mirpur");
  });
});

describe("groupAreas", () => {
  const row = (id: number, name: string, parentId: number | null, hidden = false): ModArea => ({
    id,
    slug: name.toLowerCase(),
    name,
    parentId,
    lat: null,
    lng: null,
    hidden,
    hiddenReason: hidden ? "gone" : null,
  });

  it("groups sub-areas under their parent, hidden ones included, in the order sent", () => {
    const groups = groupAreas([
      row(1, "Mirpur", null),
      row(2, "Uttara", null, true),
      row(3, "Pallabi", 1, true),
      row(4, "Mirpur 10", 1),
    ]);
    expect(groups.map((g) => g.area.name)).toEqual(["Mirpur", "Uttara"]);
    expect(groups[0]!.children.map((c) => c.name)).toEqual(["Pallabi", "Mirpur 10"]);
    expect(groups[1]!.children).toEqual([]);
  });
});

describe("areaMatches", () => {
  const pointed: AreaOption[] = [
    { ...options[0]!, lat: 23.8151, lng: 90.4253 },
    {
      ...options[1]!,
      lat: 23.8223,
      lng: 90.3654,
      children: [
        { id: 20, slug: "mirpur-mirpur-10", name: "Mirpur 10", lat: 23.8069, lng: 90.3687 },
        { id: 21, slug: "mirpur-pallabi", name: "Pallabi", lat: null, lng: null },
      ],
    },
    { ...options[2]!, lat: null, lng: null },
  ];

  it("matches by name, case-insensitively, with the name's start first and a point on every row", () => {
    expect(areaMatches(pointed, "PUR", 5).map((m) => m.name)).toEqual(["Mirpur", "Mirpur 10"]);
    expect(areaMatches(pointed, "10", 5)).toEqual([
      { id: 20, name: "Mirpur 10", parentName: "Mirpur", point: { lat: 23.8069, lng: 90.3687 } },
    ]);
  });

  it("lets a sub-area with no point stand where its parent does, and skips an area with none", () => {
    expect(areaMatches(pointed, "pallabi", 5)).toEqual([
      { id: 21, name: "Pallabi", parentName: "Mirpur", point: { lat: 23.8223, lng: 90.3654 } },
    ]);
    expect(areaMatches(pointed, "uttara", 5)).toEqual([]);
  });

  it("returns nothing for empty text and at most `max` rows", () => {
    expect(areaMatches(pointed, "  ", 5)).toEqual([]);
    expect(areaMatches(pointed, "mir", 1)).toHaveLength(1);
  });
});
