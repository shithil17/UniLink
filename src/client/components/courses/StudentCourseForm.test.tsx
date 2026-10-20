// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { StudentCourseForm } from "./StudentCourseForm";

afterEach(() => {
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
  });
});
