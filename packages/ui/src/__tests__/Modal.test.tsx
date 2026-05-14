import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Modal } from "../Modal";

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}}>
        Content
      </Modal>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders content when open", () => {
    render(
      <Modal open={true} onClose={() => {}}>
        Modal content
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(
      <Modal open={true} onClose={() => {}} title="Confirm">
        Body
      </Modal>
    );
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        Body
      </Modal>
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        Body
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose}>
        Body
      </Modal>
    );
    // The overlay is the first child with aria-hidden
    const overlay = document.querySelector("[aria-hidden='true']");
    if (overlay) fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has aria-modal attribute", () => {
    render(
      <Modal open={true} onClose={() => {}} title="Accessible">
        Body
      </Modal>
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });
});
