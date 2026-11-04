// @vitest-environment happy-dom
import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, waitFor, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../shared/schemas/auth";
import type { CgpaSummary } from "../../shared/schemas/attempts";
import type { CourseMap } from "../../shared/schemas/courses";
import { routeTree } from "../routeTree.gen";

vi.mock("@/components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/pwa/InstallHint", () => ({ InstallHint: () => null }));

const me: Me = {
  username: "dev_cse",
  role: "student",
  admissionYear: 22,
  mustChangePassword: false,
};

const slot: CourseMap["categories"][number]["slots"][number] = {
  kind: "course",
  code: "CSE101",
  title: "Programming I",
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
};

const map: CourseMap = {
  curriculum: {
    id: 1,
    programCode: "CSE",
    programName: "Computer Science and Engineering",
    name: "CSE",
    version: "2022",
    effectiveFromYear: 2022,
  },
  degree: { required: 130, earned: 0 },
  categories: [{ name: "Core", required: 3, earned: 0, trails: null, slots: [slot] }],
  extras: [],
};

const summary: CgpaSummary = {
  cgpa: null,
  gradedCredits: 0,
  earnedCredits: 0,
  requiredCredits: 130,
  remainingCredits: 130,
  categories: [],
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderCourses(path: string) {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  class Matrix {
    m22 = 1;
    inverse() {
      return this;
    }
    scale() {
      return this;
    }
  }
  vi.stubGlobal("DOMMatrixReadOnly", Matrix);
  vi.stubGlobal("DOMMatrix", Matrix);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("No network in this test"))),
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } },
  });
  queryClient.setQueryData(["me"], me);
  queryClient.setQueryData(["course-map"], map);
  queryClient.setQueryData(["attempts", "list"], []);
  queryClient.setQueryData(["attempts", "summary"], summary);
  queryClient.setQueryData(["planner", "target"], { targetCgpa: null });
  queryClient.setQueryData(["inbox", "unread-count"], { count: 0 });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("course planner route", () => {
  it("is a third view in the toggle, and lists the unfinished course with a mock picker", async () => {
    renderCourses("/courses?view=planner");
    const planner = await screen.findByRole("button", { name: "Planner" });
    expect(planner.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "Your CGPA" })).toBeTruthy();
    // No target yet: the advice panel asks for one.
    expect(screen.getByText(/Set a target CGPA/)).toBeTruthy();
    expect(screen.getByText("Estimates only. Retake rules and fees are set by NSU.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /^Upcoming/ }));
    expect(await screen.findByRole("combobox", { name: "Mock grade for CSE101" })).toBeTruthy();
  });

  it("shows a refused target as an error on the field, not a toast", async () => {
    renderCourses("/courses?view=planner");
    const input = await screen.findByLabelText("Target CGPA");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: "target_not_above_current",
              message: "Set a target above it.",
            }),
            { status: 409, headers: { "content-type": "application/json" } },
          ),
        ),
      ),
    );
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));
    expect(await screen.findByText("Set a target above it.")).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("rejects a value outside 0.01 to 4.00 before it reaches the server", async () => {
    renderCourses("/courses?view=planner");
    const input = await screen.findByLabelText("Target CGPA");
    fireEvent.change(input, { target: { value: "4.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));
    expect(await screen.findByText("Enter a number between 0.01 and 4.00.")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("course roadmap route", () => {
  it("opens the CGPA summary over the sheet and lets the button hide it", async () => {
    renderCourses("/courses?view=sequence");
    await screen.findByRole("region", { name: "Course roadmap" });
    const summaryButton = screen.getByRole("button", { name: "CGPA summary" });
    expect(screen.queryByRole("heading", { name: "CGPA" })).toBeNull();
    fireEvent.click(summaryButton);
    expect(await screen.findByRole("heading", { name: "CGPA" })).toBeTruthy();
    expect(summaryButton.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(summaryButton);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "CGPA" })).toBeNull());
  });

  it("offers List and Roadmap, and the tile opens the roadmap without retiring itself", async () => {
    renderCourses("/courses");
    expect(await screen.findByRole("button", { name: "List" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Roadmap" })).toBeTruthy();
    expect(screen.getByText("See your degree as a roadmap")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open roadmap" }));
    await screen.findByRole("region", { name: "Course roadmap" });
    expect(localStorage.getItem("unilink-roadmap-tip")).toBeNull();
  });

  it("hides the tile only for now when dismissed without don't show again", async () => {
    renderCourses("/courses");
    fireEvent.click(await screen.findByRole("button", { name: "Hide roadmap tip" }));
    expect(screen.queryByText("See your degree as a roadmap")).toBeNull();
    expect(localStorage.getItem("unilink-roadmap-tip")).toBeNull();
  });

  it("hides the tile for good when dismissed with don't show again ticked", async () => {
    renderCourses("/courses");
    fireEvent.click(await screen.findByRole("checkbox", { name: "Don't show again" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide roadmap tip" }));
    expect(screen.queryByText("See your degree as a roadmap")).toBeNull();
    expect(localStorage.getItem("unilink-roadmap-tip")).toBe("done");
  });

  it("does not show the tile when the tip is already done", async () => {
    localStorage.setItem("unilink-roadmap-tip", "done");
    renderCourses("/courses");
    await screen.findByRole("button", { name: "Roadmap" });
    expect(screen.queryByText("See your degree as a roadmap")).toBeNull();
  });
});
