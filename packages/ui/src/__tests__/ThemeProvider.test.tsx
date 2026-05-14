import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ThemeProvider, useTheme } from "../ThemeProvider";

function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("defaults to dark theme when no preference is stored", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("reads stored theme preference from localStorage", () => {
    localStorage.setItem("kiroportal-theme", "light");
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("toggles theme and persists to localStorage", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    act(() => {
      screen.getByText("Toggle").click();
    });

    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(localStorage.getItem("kiroportal-theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("falls back to dark theme if localStorage is unreadable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    vi.restoreAllMocks();
  });

  it("throws error when useTheme is used outside ThemeProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ThemeConsumer />)).toThrow(
      "useTheme must be used within a ThemeProvider"
    );
    consoleSpy.mockRestore();
  });
});
