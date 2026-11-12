// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { StudentCourseForm } from "./StudentCourseForm";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/toast", () => ({ toast: { error: toastError, success: vi.fn() } }));

afterEach(() => {
  toastError.mockClear();
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const ECO = { code: "ECO101", title: "Principles of Economics", credits: 3, trail: null };

function setup(category = "Open Elective") {
  const fetchMock = vi.fn(async (url: string) =>
    url.includes("code=ECO101")
      ? Response.json(ECO)
      : Response.json({ error: "not_found" }, { status: 404 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <StudentCourseForm
        categories={["Electives", "Open Elective"]}
        trailCategory="Electives"
        initial={{ category }}
        onSaved={() => {}}
        onCancel={() => {}}
      />
    </QueryClientProvider>,
  );
  return fetchMock;
}

const typeCode = (value: string) =>
  fireEvent.change(screen.getByLabelText("Course code"), { target: { value } });
const settle = () => act(() => vi.advanceTimersByTimeAsync(500));
const title = () => screen.getByLabelText("Title") as HTMLInputElement;
const credits = () => screen.getByLabelText("Credits") as HTMLInputElement;

describe("StudentCourseForm lookup", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

  it("fills an empty title and credits from a found code and says what it found", async () => {
    setup();
    typeCode("eco101");
    await settle();
    await waitFor(() => expect(title().value).toBe("Principles of Economics"));
    expect(credits().value).toBe("3");
    expect(screen.getByText("Found: Principles of Economics, 3 cr")).toBeTruthy();
  });

  it("leaves a title the student already typed alone", async () => {
    setup();
    fireEvent.change(title(), { target: { value: "My own title" } });
    typeCode("ECO101");
    await settle();
    await waitFor(() => expect(credits().value).toBe("3"));
    expect(title().value).toBe("My own title");
  });

  it("says nothing and fills nothing for an unknown code", async () => {
    const fetchMock = setup();
    typeCode("ZZZ999");
    await settle();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(title().value).toBe("");
    expect(screen.queryByText(/Found:/)).toBeNull();
    // The line under the code field is always there, so the form does not grow or shrink.
    expect(screen.getByText(/Type a code and we'll fill in/)).toBeTruthy();
  });

  it("does not look anything up for a malformed code", async () => {
    const fetchMock = setup();
    typeCode("EC");
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("StudentCourseForm category hint", () => {
  it("shows the any-discipline hint outside the trail category only", () => {
    setup("Open Elective");
    expect(screen.getByText(/Any course from any discipline/)).toBeTruthy();
    cleanup();
    setup("Electives");
    expect(screen.queryByText(/Any course from any discipline/)).toBeNull();
    // The trail category gets its own line instead, so the hint row never disappears.
    expect(screen.getByText(/count toward your elective trails/)).toBeTruthy();
  });
});

describe("StudentCourseForm errors reach the user as toasts", () => {
  it("toasts a taken code from the server and still marks the field for screen readers", async () => {
    const message = "You already have a course with that code.";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? Response.json({ error: "code_taken", message }, { status: 409 })
          : Response.json({ error: "not_found" }, { status: 404 }),
      ),
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <StudentCourseForm
          categories={["Open Elective"]}
          initial={{ category: "Open Elective" }}
          onSaved={() => {}}
          onCancel={() => {}}
        />
      </QueryClientProvider>,
    );
    typeCode("ECO101");
    fireEvent.change(title(), { target: { value: "Economics" } });
    fireEvent.change(credits(), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Add course" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(message));
    const alert = await screen.findByRole("alert");
    expect(alert.className).toContain("sr-only");
    expect(alert.textContent).toBe(message);
  });

  it("toasts the first invalid field on a failed submit", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Add course" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
  });
});
