// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { resetStagger } from "@/lib/useStagger";
import type { CgpaSummary } from "../../shared/schemas/attempts";
import type { Me } from "../../shared/schemas/auth";
import type { CourseMap } from "../../shared/schemas/courses";
import { Route as HomeRoute } from "./index";

const STUDENT_ID = "2212345042";

type Slot = CourseMap["categories"][number]["slots"][number];
const slot = (n: number, over: Partial<Slot> = {}): Slot => ({
  kind: "course",
  code: `CSE${100 + n}`,
  title: `Course ${n}`,
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

const mapWith = (slots: Slot[]): CourseMap => ({
  curriculum: {
    id: 1,
    programCode: "CSE",
    programName: "Computer Science and Engineering",
    name: "CSE",
    version: "1",
    effectiveFromYear: 2022,
  },
  degree: { required: 130, earned: 96 },
  categories: [{ name: "Core", required: 60, earned: 30, slots, trails: null }],
  extras: [],
});

const summary: CgpaSummary = {
  cgpa: 3.4567,
  gradedCredits: 48,
  earnedCredits: 96,
  requiredCredits: 130,
  remainingCredits: 34,
  categories: [],
};

// The cached `me` carries a student ID the real API never sends; nothing may print it.
const me = {
  username: "apollo",
  role: "student",
  admissionYear: 22,
  mustChangePassword: false,
  studentId: STUDENT_ID,
} as Me;

beforeEach(() => {
  resetStagger();
  // Anything not seeded below fails to load, like a dropped connection.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("offline"))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderHome(seed: {
  me: Me | null;
  map?: CourseMap;
  cgpa?: CgpaSummary;
  routine?: unknown[];
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } },
  });
  client.setQueryData(["me"], seed.me);
  if (seed.map) client.setQueryData(["course-map"], seed.map);
  if (seed.cgpa) client.setQueryData(["attempts", "summary"], seed.cgpa);
  if (seed.routine) client.setQueryData(["routine", "list"], seed.routine);
  const root = createRootRoute();
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: HomeRoute.options.component,
  });
  const others = ["/courses", "/routine", "/login", "/signup"].map((path) =>
    createRoute({ getParentRoute: () => root, path }),
  );
  const router = createRouter({
    routeTree: root.addChildren([home, ...others]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  // Signed out, Home renders nothing of its own and redirects.
  if (seed.me) await screen.findByRole("heading", { level: 1 });
  return router;
}

const slots = (n: number) => Array.from({ length: n }, (_, i) => slot(i));

describe("Home", () => {
  it("lists at most 6 unlocked courses, says how many there are, and never prints a student ID", async () => {
    await renderHome({ me, map: mapWith(slots(12)), cgpa: summary, routine: [] });

    const panel = screen.getByRole("region", { name: "Unlocked next" });
    expect(within(panel).getAllByRole("listitem")).toHaveLength(6);
    expect(within(panel).getByText("Showing 6 of 12")).toBeTruthy();
    expect(within(panel).getByText("CSE100")).toBeTruthy();
    expect(within(panel).queryByText("CSE106")).toBeNull();

    expect(document.body.textContent).not.toContain(STUDENT_ID);
  });

  it("greets by username and shows the CGPA and credits tiles", async () => {
    await renderHome({ me, map: mapWith(slots(2)), cgpa: summary, routine: [] });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /^Good (morning|afternoon|evening), apollo$/,
    );
    expect(screen.getByText("3.46")).toBeTruthy();
    expect(screen.getByText("34 to go")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Record a grade" }).getAttribute("href")).toBe(
      "/courses",
    );
    // Two rows fit, so there is no "Showing" note.
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it("says nothing is waiting when no course is unlocked", async () => {
    await renderHome({
      me,
      map: mapWith([slot(1, { status: "done" })]),
      cgpa: summary,
      routine: [],
    });
    expect(screen.getByText("Nothing is waiting for you.")).toBeTruthy();
  });

  it("keeps Home usable when the CGPA fails to load", async () => {
    await renderHome({ me, map: mapWith(slots(3)), routine: [] });
    expect(await screen.findByText("Your CGPA did not load.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
  });

  it("explains a program without a course map", async () => {
    await renderHome({ me, map: { ...mapWith([]), curriculum: null }, routine: [] });
    expect(screen.getByText("No course map for your program yet")).toBeTruthy();
  });

  it("sends a signed-out visitor to log in", async () => {
    const router = await renderHome({ me: null });
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });
});
