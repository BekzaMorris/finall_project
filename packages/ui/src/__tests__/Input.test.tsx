import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Input } from "../Input";

describe("Input", () => {
  it("renders with a label", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows error message when error prop is set", () => {
    render(<Input label="Email" error="Email is required" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Email is required");
  });

  it("applies error styling when error is present", () => {
    render(<Input label="Email" error="Required" />);
    const input = screen.getByLabelText("Email");
    expect(input.className).toContain("border-status-error");
  });

  it("sets aria-invalid when error is present", () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("is disabled when disabled prop is set", () => {
    render(<Input label="Name" disabled />);
    expect(screen.getByLabelText("Name")).toBeDisabled();
  });
});
