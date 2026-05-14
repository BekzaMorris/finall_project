import { type SelectHTMLAttributes, forwardRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = "", id, disabled, ...props }, ref) => {
    const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-text-primary"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          className={[
            "w-full rounded-md border bg-surface-secondary px-3 py-2 text-sm text-text-primary",
            "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-status-error focus:ring-status-error"
              : "border-border-primary",
            className,
          ].join(" ")}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error && selectId ? `${selectId}-error` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p
            id={selectId ? `${selectId}-error` : undefined}
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

Select.displayName = "Select";
