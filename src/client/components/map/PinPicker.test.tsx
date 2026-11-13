// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { toast } from "@/lib/toast";
import { liveMaps, resetFakeMaps, type Map as FakeMap } from "@/test/fakeMapLibre";
import { PIN_HINT, PinPicker, type PinPickerProps } from "./PinPicker";

vi.mock("@/lib/map/maplibre", () => import("@/test/fakeMapLibre"));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
  resetFakeMaps();
  vi.mocked(toast.error).mockClear();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

function renderPicker(props: Partial<PinPickerProps> = {}) {
  const onConfirm = vi.fn();
  const onRemove = vi.fn();
  const onClose = vi.fn();
  render(
    <PinPicker
      open
      onClose={onClose}
      label="Pin the pickup"
      point={null}
      fallback={null}
      onConfirm={onConfirm}
      onRemove={onRemove}
      {...props}
    />,
  );
  return { onConfirm, onRemove, onClose };
}

async function readyMap(): Promise<FakeMap> {
  await waitFor(() => expect(liveMaps()).toHaveLength(1));
  await waitFor(() => expect(screen.queryByText("Loading the map")).toBeNull());
  return liveMaps()[0]!;
}

const use = () => screen.getByRole("button", { name: "Use this spot" }) as HTMLButtonElement;
const status = () => screen.getByRole("status", { name: "" });

describe("PinPicker", () => {
  it("opens on NSU with the hint, an always-present status line and nothing to confirm yet", async () => {
    renderPicker();
    const map = await readyMap();
    expect(map.options.center).toEqual([90.4253, 23.8151]);
    expect(screen.getByText(PIN_HINT)).toBeTruthy();
    expect(status().textContent).toBe("Move the map to place the pin");
    expect(use().disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Remove pin" })).toBeNull();
    // The title floats beside the close button until a search takes its place.
    expect(screen.getByText("Pin the pickup", { selector: "p" })).toBeTruthy();
  });

  it("returns the map centre, rounded to 5 decimals, and closes", async () => {
    const { onConfirm, onClose } = renderPicker();
    const map = await readyMap();
    act(() => map.moveTo({ lat: 23.8123456, lng: 90.4012349 }));
    await waitFor(() => expect(use().disabled).toBe(false));
    expect(status().textContent).toBe("Pin placed. Tap Use this spot to keep it.");
    fireEvent.click(use());
    expect(onConfirm).toHaveBeenCalledWith({ lat: 23.81235, lng: 90.40123 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("never saves the spot it opened on: an area's centre is not a pin until the map moves", async () => {
    const { onConfirm } = renderPicker({ fallback: { lat: 23.9, lng: 90.4 } });
    const map = await readyMap();
    // It opens on the area's point at street zoom.
    expect(map.options.bounds).toEqual([
      [90.4, 23.9],
      [90.4, 23.9],
    ]);
    expect(use().disabled).toBe(true);
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Move the map to place the pin first.");
  });

  it("opens on the saved pin, keeps it when confirmed unmoved, and removes it", async () => {
    const saved = { lat: 23.8111, lng: 90.4222 };
    const { onConfirm, onRemove, onClose } = renderPicker({ point: saved });
    const map = await readyMap();
    expect(map.options.bounds).toEqual([
      [90.4222, 23.8111],
      [90.4222, 23.8111],
    ]);
    expect(status().textContent).toBe("Pinned. Move the map to change it.");
    expect(use().disabled).toBe(false);
    fireEvent.click(use());
    expect(onConfirm).toHaveBeenCalledWith(saved);

    fireEvent.click(screen.getByRole("button", { name: "Remove pin" }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("confirms with Enter, but leaves Enter to a field in the search slot", async () => {
    const { onConfirm } = renderPicker({
      search: () => <input aria-label="Search places" />,
    });
    const map = await readyMap();
    act(() => map.moveTo({ lat: 23.79, lng: 90.41 }));
    await waitFor(() => expect(use().disabled).toBe(false));

    fireEvent.keyDown(screen.getByLabelText("Search places"), { key: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledWith({ lat: 23.79, lng: 90.41 });
  });

  it("hands the search slot a way to move the map", async () => {
    let flyTo: (point: { lat: number; lng: number }) => void = () => {};
    renderPicker({
      search: (controls) => {
        flyTo = controls.flyTo;
        return <input aria-label="Search places" />;
      },
    });
    const map = await readyMap();
    await waitFor(() => expect(map.getCenter()).toBeTruthy());
    // Rendered again once the map is known, so the slot's controls point at it.
    await waitFor(() => {
      flyTo({ lat: 23.75, lng: 90.39 });
      expect(map.called("flyTo").length + map.called("jumpTo").length).toBeGreaterThan(0);
    });
    expect(map.getCenter()).toEqual({ lat: 23.75, lng: 90.39 });
  });
});
