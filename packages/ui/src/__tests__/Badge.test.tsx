import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "../Badge";

describe("Badge", () => {
  it("renders with text", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    render(<Badge data-testid="badge">Default</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("bg-surface-tertiary");
  });

  it("applies success variant classes", () => {
    render(<Badge variant="success" data-testid="badge">Active</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("text-status-success");
  });

  it("applies warning variant classes", () => {
    render(<Badge variant="warning" data-testid="badge">Pending</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("text-status-warning");
  });

  it("applies error variant classes", () => {
    render(<Badge variant="error" data-testid="badge">Failed</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("text-status-error");
  });

  it("applies info variant classes", () => {
    render(<Badge variant="info" data-testid="badge">Info</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("text-accent-secondary");
  });
});
