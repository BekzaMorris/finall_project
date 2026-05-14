import { type InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, disabled, ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-primary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={[
            "w-full rounded-md border bg-surface-secondary px-3 py-2 text-sm text-text-primary",
            "placeholder:text-text-tertiary",
            "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-status-error focus:ring-status-error"
              : "border-border-primary",
            className,
          ].join(" ")}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error && inputId ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p
            id={inputId ? `${inputId}-error` : undefined}
            className="text-sm text-status-error"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
