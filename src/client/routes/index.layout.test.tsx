import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { AppLayout } from "@/components/layout/AppLayout";
import { onPhone, PHONES, sidewaysOverflow } from "@/test/layout";
import type { CgpaSummary } from "../../shared/schemas/attempts";
import type { Me } from "../../shared/schemas/auth";
import type { CourseMap } from "../../shared/schemas/courses";
import type { RoutineEntry } from "../../shared/schemas/routine";
import { Route as HomeRoute } from "./index";

// The PWA prompts talk to the service worker, which the test frame does not have.
vi.mock("@/components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/pwa/InstallHint", () => ({ InstallHint: () => null }));

// Sunday 10:00 in Dhaka, an hour before the routine's class, so the next-class pill shows.
const SUNDAY_10AM_DHAKA = Date.UTC(2026, 9, 25, 4, 0);

// The widest content a student can have: the longest username, long titles, an open choice slot.
const me = {
  username: "abcdefghij_klmnopqrs",
  role: "student",
  admissionYear: 22,
  mustChangePassword: false,
} as Me;

type Slot = CourseMap["categories"][number]["slots"][number];
const slot = (n: number, over: Partial<Slot> = {}): Slot => ({
  kind: "course",
  code: `CSE${100 + n}`,
  title: `Introduction to Computer Systems and Engineering Practice ${n}`,
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

const map: CourseMap = {
  curriculum: {
    id: 1,
    programCode: "CSE",
    programName: "Computer Science and Engineering",
    name: "CSE",
    version: "1",
    effectiveFromYear: 2022,
  },
  degree: { required: 130, earned: 13 },
  categories: [
    {
      name: "Core",
      required: 60,
      earned: 13,
      slots: [
        slot(0, {
          code: "CSE115L",
          alternatives: [
            { code: "CSE215L", title: "Programming Language II Lab" },
            { code: "CSE225L", title: "Data Structures and Algorithms Lab" },
          ],
        }),
        ...Array.from({ length: 9 }, (_, i) => slot(i + 1)),
      ],
      trails: null,
    },
  ],
  extras: [],
};

const cgpa: CgpaSummary = {
  cgpa: 3.91,
  gradedCredits: 10,
  earnedCredits: 13,
  requiredCredits: 130,
  remainingCredits: 117,
  categories: [],
};

const routine: RoutineEntry[] = [
  {
    id: 1,
    term: { year: 2026, season: "fall" },
    courseCode: "CSE115L",
    section: 12,
    days: ["S", "T"],
    start: "11:00",
    end: "12:30",
    room: "SAC 1234 LAB",
    initials: "ABCDEFGHIJ",
  },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: SUNDAY_10AM_DHAKA });
  // Anything not seeded stays loading, so each case shows exactly the state it names.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderHome(seed: {
  me?: Me | null;
  map?: CourseMap;
  cgpa?: CgpaSummary;
  routine?: RoutineEntry[];
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } },
  });
  if (seed.me !== undefined) client.setQueryData(["me"], seed.me);
  if (seed.map) client.setQueryData(["course-map"], seed.map);
  if (seed.cgpa) client.setQueryData(["attempts", "summary"], seed.cgpa);
  if (seed.routine) client.setQueryData(["routine", "list"], seed.routine);
  client.setQueryData(["inbox", "unread-count"], { count: 120 });
  // Home inside the real shell, so its padding and the floating tab bar count.
  const root = createRootRoute({
    component: () => (
      <AppLayout>
        <Outlet />
      </AppLayout>
    ),
  });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: HomeRoute.options.component,
  });
  const others = ["/courses", "/routine", "/inbox", "/settings", "/login", "/signup"].map((path) =>
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
  await screen.findByRole("heading", { level: 1 });
}

const states = [
  { name: "with grades, a class coming up and unlocked courses", seed: { me, map, cgpa, routine } },
  { name: "while the CGPA loads", seed: { me, map, routine: [] } },
  { name: "with no routine yet", seed: { me, map, cgpa, routine: [] } },
  { name: "while everything loads", seed: {} },
  { name: "without a course map", seed: { me, map: { ...map, curriculum: null }, routine } },
];

// Four widths bracket the range: the smallest Android, two common phones and the widest.
const WIDTHS = [320, 360, 390, 430];

describe.each(PHONES.filter((p) => WIDTHS.includes(p.width)))(
  "Home on $name ($width px)",
  (phone) => {
    it.each(states)("never scrolls sideways $name", async ({ seed }) => {
      await onPhone(phone);
      await renderHome(seed);
      expect(sidewaysOverflow()).toEqual([]);
    });
  },
);
