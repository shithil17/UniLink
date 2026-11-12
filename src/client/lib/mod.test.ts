import { keepPreviousData } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";
import { modUsersList } from "./mod";

describe("modUsersList", () => {
  it("keeps the previous results on screen while a new search loads", () => {
    expect(modUsersList("ra").placeholderData).toBe(keepPreviousData);
  });
});
