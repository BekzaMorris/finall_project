import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card } from "../Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies border and background classes", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("border-border-primary");
    expect(card.className).toContain("bg-surface-secondary");
  });

  it("applies hover effect when hoverable", () => {
    render(<Card hoverable data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("hover:border-accent-primary/50");
    expect(card.className).toContain("cursor-pointer");
  });

  it("does not apply hover effect by default", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).not.toContain("cursor-pointer");
  });
});
