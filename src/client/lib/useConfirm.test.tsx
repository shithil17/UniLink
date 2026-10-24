// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ApiError } from "./api";
import type { ConfirmContent } from "./modConfirm";
import { useConfirm } from "./useConfirm";

afterEach(cleanup);

const content: ConfirmContent = {
  title: "Ban user",
  confirmLabel: "Ban user",
  destructive: true,
  lead: "rafi_2 will be banned.",
  facts: [
    { label: "User", value: "rafi_2 · Student" },
    { label: "Reason", value: "posted a scam" },
  ],
  changes: [{ label: "Role", before: "Student", after: "Mod" }],
  counts: [{ label: "Added", value: "4" }],
  effects: ["They're signed out everywhere."],
};

function Harness({ run }: { run: () => Promise<unknown> }) {
  const confirm = useConfirm();
  return (
    <>
      <button type="button" onClick={() => confirm.ask({ ...content, run })}>
        Open
      </button>
      {confirm.element}
    </>
  );
}

const open = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  return (await screen.findByRole("heading", { name: "Ban user" })).closest<HTMLElement>(
    '[role="dialog"]',
  )!;
};

describe("confirm sheet", () => {
  it("shows the summary and sends nothing until the confirm button is pressed", async () => {
    const run = vi.fn(async () => {});
    render(<Harness run={run} />);
    const sheet = await open();
    expect(within(sheet).getByText("rafi_2 will be banned.")).toBeTruthy();
    expect(within(sheet).getByText("posted a scam")).toBeTruthy();
    expect(within(sheet).getByText("Student")).toBeTruthy();
    expect(within(sheet).getByText("Mod")).toBeTruthy();
    expect(within(sheet).getByText("4")).toBeTruthy();
    expect(within(sheet).getByText("They're signed out everywhere.")).toBeTruthy();
    expect(run).not.toHaveBeenCalled();

    fireEvent.click(within(sheet).getByRole("button", { name: "Ban user" }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Ban user" })).toBeNull());
  });

  it("fires nothing on Cancel and closes", async () => {
    const run = vi.fn(async () => {});
    render(<Harness run={run} />);
    const sheet = await open();
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Ban user" })).toBeNull());
    expect(run).not.toHaveBeenCalled();
  });

  it("shows progress and ignores a second tap while the request runs", async () => {
    let finish: () => void = () => {};
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<Harness run={run} />);
    const sheet = await open();
    const confirm = within(sheet).getByRole("button", { name: "Ban user" });
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm.getAttribute("aria-busy")).toBe("true"));
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(run).toHaveBeenCalledTimes(1);
    expect(
      (within(sheet).getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    finish();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Ban user" })).toBeNull());
  });

  it("stays open with the error inline when the request fails, and can be retried", async () => {
    const run = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(
        new ApiError(409, { error: "already_banned", message: "That user is already banned." }),
      )
      .mockResolvedValueOnce(undefined);
    render(<Harness run={run} />);
    const sheet = await open();
    fireEvent.click(within(sheet).getByRole("button", { name: "Ban user" }));
    expect((await within(sheet).findByRole("alert")).textContent).toContain("already banned");
    expect(within(sheet).getByRole("button", { name: "Ban user" })).toBeTruthy();

    fireEvent.click(within(sheet).getByRole("button", { name: "Ban user" }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Ban user" })).toBeNull());
  });

  it("wears the destructive style for a destructive action", async () => {
    render(<Harness run={async () => {}} />);
    const sheet = await open();
    expect(within(sheet).getByRole("button", { name: "Ban user" }).className).toContain(
      "bg-destructive",
    );
  });
});
