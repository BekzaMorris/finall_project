import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Select } from "../Select";

const options = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

describe("Select", () => {
  it("renders options", () => {
    render(<Select options={options} />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
  });

  it("renders with a label", () => {
    render(<Select label="Category" options={options} />);
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
  });

  it("renders placeholder option", () => {
    render(<Select options={options} placeholder="Select one..." />);
    expect(screen.getByText("Select one...")).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(<Select options={options} label="Type" error="Required" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });

  it("is disabled when disabled prop is set", () => {
    render(<Select label="Type" options={options} disabled />);
    expect(screen.getByLabelText("Type")).toBeDisabled();
  });
});
