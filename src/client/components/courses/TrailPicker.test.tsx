// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { CourseMapTrails } from "../../../shared/schemas/courses";
import { TrailPicker } from "./TrailPicker";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const trails: CourseMapTrails = {
  minFromOneTrail: 2,
  met: false,
  leading: "Artificial Intelligence",
  trails: [
    {
      name: "Artificial Intelligence",
      done: 1,
      added: 1,
      courses: [
        { code: "CSE445", title: "Machine Learning", credits: 3, state: "done" },
        { code: "CSE440", title: "Artificial Intelligence", credits: 3, state: "added" },
        { code: "CSE467", title: "Computer Vision", credits: 3, state: null },
      ],
    },
    {
      name: "Networks",
      done: 0,
      added: 0,
      courses: [{ code: "CSE422", title: "Computer Networks II", credits: 3, state: null }],
    },
  ],
};

function setup(fetchImpl?: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn(
    async (url: string, init?: RequestInit) =>
      fetchImpl?.(url, init) ??
      Response.json(
        {
          id: 1,
          code: "CSE467",
          title: "Computer Vision",
          credits: 3,
          category: "Electives",
          excluded: false,
          createdAt: 0,
        },
        { status: 201 },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  const onAdded = vi.fn();
  const onNotListed = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Sheet open>
        <SheetContent side="bottom">
          <TrailPicker
            category="Electives"
            trails={trails}
            onAdded={onAdded}
            onNotListed={onNotListed}
          />
        </SheetContent>
      </Sheet>
    </QueryClientProvider>,
  );
  return { fetchMock, onAdded, onNotListed };
}

describe("TrailPicker", () => {
  it("lists every trail with its done count against the minimum", () => {
    setup();
    const ai = screen.getByRole("region", { name: "Artificial Intelligence" });
    expect(within(ai).getByText("1 of 2 done")).toBeTruthy();
    const net = screen.getByRole("region", { name: "Networks" });
    expect(within(net).getByText("0 of 2 done")).toBeTruthy();
  });

  it("filters by code or title and hides trails with no match", () => {
    setup();
    const search = screen.getByRole("searchbox", { name: "Search by code or title" });
    fireEvent.change(search, { target: { value: "cse422" } });
    expect(screen.queryByRole("region", { name: "Artificial Intelligence" })).toBeNull();
    expect(screen.getByRole("button", { name: /Computer Networks II/ })).toBeTruthy();
    fireEvent.change(search, { target: { value: "vision" } });
    expect(screen.getByRole("button", { name: /Computer Vision/ })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Networks" })).toBeNull();
    fireEvent.change(search, { target: { value: "zzzz" } });
    expect(screen.getByText("No course matches that search.")).toBeTruthy();
  });

  it("marks done and added courses and does not let them be added", () => {
    const { fetchMock } = setup();
    const done = screen.getByRole("button", { name: /Machine Learning/ }) as HTMLButtonElement;
    const added = screen.getByRole("button", { name: /Artificial Intelligence CSE440/ });
    expect(done.disabled).toBe(true);
    expect((added as HTMLButtonElement).disabled).toBe(true);
    expect(within(done).getByText("Done")).toBeTruthy();
    expect(within(added).getByText("Added")).toBeTruthy();
    fireEvent.click(done);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds the tapped course to the trail category, then closes", async () => {
    const { fetchMock, onAdded } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Computer Vision/ }));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/student-courses");
    expect(JSON.parse(init?.body as string)).toEqual({
      code: "CSE467",
      title: "Computer Vision",
      credits: 3,
      category: "Electives",
      excluded: false,
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("toasts the error and stays open when the code is taken", async () => {
    const { onAdded } = setup(() =>
      Response.json({ error: "code_taken", message: "You already have CSE467" }, { status: 409 }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Computer Vision/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onAdded).not.toHaveBeenCalled();
  });
});
