import { describe, expect, it } from "vite-plus/test";
import { userSearchParams } from "./moderation";

describe("userSearchParams", () => {
  it("keeps a valid username search, lowercased", () => {
    expect(userSearchParams.parse({ q: " Rahim_1 " })).toEqual({ q: "rahim_1" });
  });

  it("reads input the API would refuse as no search", () => {
    for (const q of ["a", "has space", "bad!", "", 42, null, ["ab"]]) {
      expect(userSearchParams.parse({ q })).toEqual({ q: undefined });
    }
    expect(userSearchParams.parse({})).toEqual({ q: undefined });
  });
});
