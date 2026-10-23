// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ErrorBlock } from "./error-block";

afterEach(cleanup);

describe("ErrorBlock", () => {
  it("is an alert with its title and message", () => {
    render(
      <ErrorBlock
        title="Couldn't load your routine"
        message="Check your connection."
        onRetry={() => {}}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Couldn't load your routine");
    expect(alert.textContent).toContain("Check your connection.");
  });

  it("calls onRetry when Retry is pressed", () => {
    const onRetry = vi.fn();
    render(<ErrorBlock onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("ignores Retry while a retry is running", () => {
    const onRetry = vi.fn();
    render(<ErrorBlock onRetry={onRetry} retrying />);
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(retry);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
