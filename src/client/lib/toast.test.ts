import { describe, expect, it, vi } from "vite-plus/test";

const error = vi.fn();
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error }) }));

const { ERROR_TOAST_MS, toast } = await import("./toast");

describe("toast", () => {
  it("holds error toasts longer", () => {
    toast.error("Offline");
    expect(error).toHaveBeenCalledWith("Offline", { duration: ERROR_TOAST_MS });
  });

  it("lets a caller still override the duration", () => {
    toast.error("Update", { duration: Infinity });
    expect(error).toHaveBeenLastCalledWith("Update", { duration: Infinity });
  });
});
