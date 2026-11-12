// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SubmitForm } from "./SubmitForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup() {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SubmitForm requestId={9} />
    </QueryClientProvider>,
  );
  return fetchMock;
}

const typeLink = (value: string) =>
  fireEvent.change(screen.getByLabelText("Link"), { target: { value } });

describe("SubmitForm", () => {
  it.each([
    ["http://drive.google.com/file/d/1", "plain http"],
    ["https://drive.google.com.evil.io/file/d/1", "a look-alike host"],
    ["https://example.com/notes.pdf", "a host that is not allowed"],
  ])("refuses %s (%s) without sending anything", async (value) => {
    const fetchMock = setup();
    typeLink(value);
    fireEvent.click(screen.getByRole("button", { name: "Send link" }));
    expect(
      await screen.findByText(
        "Use an https link from Google Drive, Dropbox, OneDrive, MEGA or GitHub",
      ),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts an allowlisted link to this request", async () => {
    const fetchMock = setup();
    fetchMock.mockResolvedValue(
      Response.json(
        {
          id: 1,
          url: "https://drive.google.com/file/d/1",
          note: null,
          status: "published",
          decision: "open",
          createdAt: 1,
        },
        { status: 201 },
      ),
    );
    typeLink("https://drive.google.com/file/d/1");
    fireEvent.click(screen.getByRole("button", { name: "Send link" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/resources/requests/9/submissions");
    expect(JSON.parse(init.body as string)).toMatchObject({
      url: "https://drive.google.com/file/d/1",
    });
  });
});
