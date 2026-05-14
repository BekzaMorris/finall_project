import { type HTMLAttributes, forwardRef, useEffect, useCallback } from "react";

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  open: boolean;
  onClose: () => void;
  title?: string;
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({ open, onClose, title, className = "", children, ...props }, ref) => {
    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      },
      [onClose]
    );

    useEffect(() => {
      if (open) {
        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
      }
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }, [open, handleKeyDown]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Overlay with glassmorphism */}
        <div
          className="absolute inset-0 bg-surface-primary/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal content */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={[
            "relative z-10 w-full max-w-lg rounded-xl border border-border-primary",
            "bg-surface-secondary/95 backdrop-blur-md p-6 shadow-2xl",
            "animate-in fade-in zoom-in-95 duration-200",
            className,
          ].join(" ")}
          {...props}
        >
          {/* Header */}
          {title && (
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Body */}
          {children}
        </div>
      </div>
    );
  }
);

Modal.displayName = "Modal";
