// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { attemptsQuery, meQuery, targetCgpaQuery } from "@/lib/queries";
import type { CourseMap } from "../../../shared/schemas/courses";
import { PlannerView } from "./PlannerView";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Slot = CourseMap["categories"][number]["slots"][number];

const slot = (over: Partial<Slot> & Pick<Slot, "code">): Slot => ({
  kind: "course",
  title: `Title ${over.code}`,
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 1,
  alternatives: [],
  prereq: null,
  status: "available",
  filledBy: null,
  chosenCode: null,
  waived: false,
  studentCourse: null,
  ...over,
});

const map = (slots: Slot[]): CourseMap => ({
  curriculum: null,
  degree: { required: 30, earned: 3 },
  categories: [{ name: "Core", required: 15, earned: 3, trails: null, slots }],
  extras: [],
});

const taken = slot({ code: "CSE101", status: "done", filledBy: "CSE101", chosenCode: "CSE101" });

function renderPlanner(courseMap: CourseMap, target: "saved" | "none" = "saved") {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnMount: false } },
  });
  client.setQueryData(meQuery.queryKey, { username: "tester" } as never);
  client.setQueryData(attemptsQuery.queryKey, [{ courseCode: "CSE101", grade: "D" }] as never);
  if (target === "saved") {
    client.setQueryData(targetCgpaQuery.queryKey, { targetCgpa: 3.5 } as never);
  }
  render(
    <QueryClientProvider client={client}>
      <PlannerView map={courseMap}>{({ main }) => main}</PlannerView>
    </QueryClientProvider>,
  );
}

describe("PlannerView", () => {
  it("opens on the advice with the retakes one tap away, not under the remaining courses", async () => {
    renderPlanner(map([taken, slot({ code: "CSE102" })]));
    expect(screen.getByRole("tab", { name: "Advice" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText("Title CSE102")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Retakes 1" }));
    // One row: the advice also names this course, and its panel leaves as the tab changes.
    await waitFor(() => expect(screen.getAllByText("Title CSE101")).toHaveLength(1));
    expect(screen.getByRole("combobox", { name: "Mock grade for CSE101" })).toBeTruthy();
    expect(screen.queryByText("Title CSE102")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Upcoming 1" }));
    await waitFor(() => expect(screen.queryByText("Title CSE101")).toBeNull());
    expect(screen.getByText("Title CSE102")).toBeTruthy();
  });

  it("always shows Clear mock grades, disabled while there are no mocks", async () => {
    renderPlanner(map([taken]));
    fireEvent.click(screen.getByRole("tab", { name: "Retakes 1" }));
    const clear = (await screen.findByRole("button", {
      name: "Clear mock grades",
    })) as HTMLButtonElement;
    expect(clear.disabled).toBe(true);
  });

  it("leaves out the tab of an empty list", () => {
    renderPlanner(map([taken]));
    expect(screen.getByRole("tab", { name: "Retakes 1" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Upcoming/ })).toBeNull();
  });

  it("does not ask for a target while it loads, and says so when it failed to load", async () => {
    const prompt = "Set a target CGPA to see what you need.";
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    renderPlanner(map([taken]), "none");
    expect(screen.queryByText(prompt)).toBeNull();
    cleanup();

    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("offline")));
    renderPlanner(map([taken]), "none");
    expect(await screen.findByText("No advice until your target loads.")).toBeTruthy();
    expect(screen.queryByText(prompt)).toBeNull();
  });
});
