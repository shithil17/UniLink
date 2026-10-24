// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SEARCH_DEBOUNCE_MS } from "@/lib/useDebouncedValue";
import { FacultyPicker } from "./FacultyPicker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const person = (id: number, name: string, initials: string | null, department = "ECE") => ({
  id,
  name,
  initials,
  designation: "Professor",
  department,
});
const SABBIR = person(1, "Sabbir Rahman", "SfR1");
const SADIA = person(2, "Sadia Rahim", "SfR2", "LAW");
const TANZIL = person(3, "Tanzilur Rahman", null);

type Handler = (url: URL) => unknown;

/** Stubs the API: `handle` answers each `/api/faculty` request with a page; every URL is recorded. */
function setup(
  handle: Handler,
  value: number | null = null,
  current?: { name: string; initials: string | null },
) {
  const urls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      const url = new URL(path, "http://app.test");
      urls.push(url);
      return Response.json(await handle(url));
    }),
  );
  const onChange = vi.fn();
  function Host() {
    const [v, setV] = useState(value);
    return (
      <FacultyPicker
        id="f"
        value={v}
        onChange={(next) => {
          setV(next);
          onChange(next);
        }}
        current={current}
      />
    );
  }
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Host />
    </QueryClientProvider>,
  );
  return { onChange, urls };
}

const page = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor });

const openPicker = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /No faculty|\(|Chosen/ }));
  return screen.findByRole("combobox", { name: "Search by name or initials" });
};

const optionTexts = () => screen.getAllByRole("option").map((o) => o.textContent);

describe("FacultyPicker", () => {
  it("asks the server for the first page only when opened", async () => {
    const { urls } = setup(() => page([SABBIR, SADIA, TANZIL]));
    await screen.findByRole("button", { name: "No faculty" });
    expect(urls).toHaveLength(0);

    await openPicker();
    expect(await screen.findByText("Tanzilur Rahman")).toBeTruthy();
    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toBe("/api/faculty");
    expect(urls[0]?.search).toBe("");
    expect(screen.getByText("Sabbir Rahman (SfR1)")).toBeTruthy();
    expect(screen.getByText(/Professor · Law/)).toBeTruthy();
  });

  it("sends the typed text to the server once typing pauses, and picks with the keyboard", async () => {
    const { onChange, urls } = setup((url) =>
      page(url.searchParams.get("q") === "sfr2" ? [SADIA] : [SABBIR, SADIA, TANZIL]),
    );
    const search = await openPicker();
    await screen.findByText("Tanzilur Rahman");

    fireEvent.change(search, { target: { value: "sfr2" } });
    // Not sent per keystroke: nothing new until the debounce has passed.
    expect(urls).toHaveLength(1);
    await waitFor(() => expect(urls.at(-1)?.searchParams.get("q")).toBe("sfr2"), {
      timeout: SEARCH_DEBOUNCE_MS * 4,
    });
    await waitFor(() =>
      expect(optionTexts()).toEqual(["No faculty", expect.stringContaining("Sadia Rahim (SfR2)")]),
    );
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("does not pick from the old results while a new term is still loading", async () => {
    const { onChange } = setup((url) =>
      page(url.searchParams.get("q") ? [SADIA] : [SABBIR, SADIA, TANZIL]),
    );
    const search = await openPicker();
    await screen.findByText("Tanzilur Rahman");
    fireEvent.change(search, { target: { value: "sad" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the newest term's results even when an older term's answer arrives last", async () => {
    const slow: { resolve: (v: unknown) => void }[] = [];
    setup((url) => {
      const q = url.searchParams.get("q");
      if (q === "sa") return new Promise((resolve) => slow.push({ resolve }));
      if (q === "sab") return page([SABBIR]);
      return page([SABBIR, SADIA, TANZIL]);
    });
    const search = await openPicker();
    await screen.findByText("Tanzilur Rahman");

    fireEvent.change(search, { target: { value: "sa" } });
    await waitFor(() => expect(slow).toHaveLength(1), { timeout: SEARCH_DEBOUNCE_MS * 4 });
    fireEvent.change(search, { target: { value: "sab" } });
    await waitFor(
      () => expect(optionTexts()).toEqual(["No faculty", expect.stringContaining("Sabbir")]),
      {
        timeout: SEARCH_DEBOUNCE_MS * 4,
      },
    );
    slow[0]?.resolve(page([SADIA]));
    await new Promise((r) => setTimeout(r, 20));
    expect(optionTexts()).toEqual(["No faculty", expect.stringContaining("Sabbir")]);
  });

  it("loads the next page after the rows on screen with the cursor, within the same search", async () => {
    const { urls } = setup((url) => {
      const cursor = url.searchParams.get("cursor");
      return cursor === "1" ? page([TANZIL]) : page([SABBIR], "1");
    });
    await openPicker();
    await screen.findByText("Sabbir Rahman (SfR1)");
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Tanzilur Rahman")).toBeTruthy();
    expect(urls.at(-1)?.searchParams.get("cursor")).toBe("1");
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(optionTexts()).toHaveLength(3);
  });

  it("sends the department filter", async () => {
    const { urls } = setup(() => page([SABBIR]));
    await openPicker();
    await screen.findByText("Sabbir Rahman (SfR1)");
    const trigger = document.querySelector<HTMLElement>('[id$="-department"]');
    fireEvent.click(trigger!);
    const law = (await screen.findAllByRole("option")).find((o) =>
      o.textContent?.startsWith("LAW"),
    );
    for (const type of ["pointerDown", "mouseDown", "pointerUp", "mouseUp", "click"] as const) {
      fireEvent[type](law!);
    }
    await waitFor(() => expect(urls.at(-1)?.searchParams.get("department")).toBe("LAW"));
  });

  it("says when nothing matches and lets the student choose no faculty", async () => {
    const { onChange } = setup((url) => page(url.searchParams.get("q") ? [] : [SABBIR]), 1);
    const search = await openPicker();
    fireEvent.change(search, { target: { value: "zzzz" } });
    expect(await screen.findByText("No faculty match that search.")).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "No faculty" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("walks the list with the arrow keys", async () => {
    const { onChange } = setup(() => page([SABBIR, SADIA, TANZIL]));
    const search = await openPicker();
    await screen.findByText("Tanzilur Rahman");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("labels the trigger with a choice made here, and with a saved one that left the list", async () => {
    setup(() => page([SABBIR, SADIA]), 99, { name: "Gone Person", initials: "GnP" });
    expect(await screen.findByRole("button", { name: "Gone Person (GnP)" })).toBeTruthy();
    await openPicker();
    fireEvent.click(await screen.findByRole("option", { name: /Sadia Rahim/ }));
    expect(await screen.findByRole("button", { name: "Sadia Rahim (SfR2)" })).toBeTruthy();
  });

  it("tells the student the list did not load, and still lets them leave without a faculty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <FacultyPicker id="f" value={null} onChange={() => {}} />
      </QueryClientProvider>,
    );
    await openPicker();
    expect(await screen.findByText("The faculty list didn't load")).toBeTruthy();
    expect(screen.getByRole("option", { name: "No faculty" })).toBeTruthy();
  });
});
