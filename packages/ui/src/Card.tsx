import { type HTMLAttributes, forwardRef } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          "rounded-lg border border-border-primary bg-surface-secondary p-4",
          "transition-all duration-200",
          hoverable
            ? "hover:border-accent-primary/50 hover:shadow-lg hover:shadow-accent-primary/5 cursor-pointer"
            : "",
          className,
        ].join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
