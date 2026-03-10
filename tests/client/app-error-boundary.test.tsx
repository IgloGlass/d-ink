import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "../../src/client/components/app-error-boundary";

function ThrowingChild(): JSX.Element {
  throw new Error("boom");
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders actionable recovery controls for client crashes", () => {
    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("The app hit a client error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Return to company landing" }),
    ).toBeInTheDocument();
  });
});
