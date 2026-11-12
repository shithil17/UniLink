import { describe, expect, it } from "vite-plus/test";
import { removalBody, userSearchParams } from "./moderation";

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

describe("removalReason", () => {
  it("refuses the author-delete reason, however it is cased or padded", () => {
    for (const reason of ["author", " Author ", "AUTHOR"]) {
      expect(removalBody.safeParse({ reason }).success).toBe(false);
    }
  });

  it("accepts any other reason, including one that only contains the word", () => {
    expect(removalBody.safeParse({ reason: "scam link" }).success).toBe(true);
    expect(removalBody.safeParse({ reason: "the author asked" }).success).toBe(true);
  });
});
