import { describe, expect, it } from "vite-plus/test";
import { auditActionLabel } from "./auditActions";

describe("auditActionLabel", () => {
  it("names what a removal took down", () => {
    expect(auditActionLabel("soft_delete", "resource_request")).toBe("Removed a request");
    expect(auditActionLabel("soft_delete", "resource_submission")).toBe("Removed a link");
    expect(auditActionLabel("soft_delete", "ride")).toBe("Removed a ride");
  });

  it("falls back to post for an unknown target, and still labels other actions", () => {
    expect(auditActionLabel("soft_delete")).toBe("Removed a post");
    expect(auditActionLabel("soft_delete", "toString")).toBe("Removed a post");
    expect(auditActionLabel("ban", "user")).toBe("Banned a user");
  });
});
