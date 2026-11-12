// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { RequestForm } from "./RequestForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup() {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const onSent = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RequestForm
        choices={[{ code: "CSE115", title: "Programming Language I" }]}
        onSent={onSent}
        onCancel={() => {}}
      />
    </QueryClientProvider>,
  );
  return { fetchMock, onSent };
}

describe("RequestForm", () => {
  it("refuses a request with neither a course nor a faculty, and sends nothing", async () => {
    const { fetchMock } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Post request" }));
    expect(await screen.findByText("A request needs a course, a faculty, or both")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says in words that expired requests and fulfilled requests are deleted", () => {
    setup();
    expect(screen.getByText(/expires without an accepted link is deleted/)).toBeTruthy();
    expect(screen.getByText(/deleted 3 months later/)).toBeTruthy();
  });

  it("turns the picked span into an expiry instant when it is sent", async () => {
    const { fetchMock } = setup();
    fetchMock.mockResolvedValue(Response.json({ message: "x" }, { status: 500 }));
    fireEvent.click(screen.getByRole("radio", { name: "3 days" }));
    // Pick a faculty-less request through the course sheet is covered by the picker's own tests;
    // here only the note path is needed, so give the form a course through its field.
    fireEvent.click(screen.getByLabelText("Course (optional)"));
    fireEvent.click(await screen.findByRole("option", { name: /CSE115/ }));
    const before = Date.now();
    fireEvent.click(screen.getByRole("button", { name: "Post request" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/resources/requests");
    const body = JSON.parse(init.body as string) as { courseCode: string; expiresAt: number };
    expect(body.courseCode).toBe("CSE115");
    const threeDays = 3 * 24 * 3_600_000;
    expect(body.expiresAt).toBeGreaterThanOrEqual(before + threeDays);
    expect(body.expiresAt).toBeLessThan(before + threeDays + 60_000);
  });
});
