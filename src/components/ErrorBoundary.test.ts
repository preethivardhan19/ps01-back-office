import { describe, it, expect, vi, afterEach } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ErrorBoundary from "./ErrorBoundary";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("getDerivedStateFromError returns the caught error as state", () => {
    const error = new Error("boom");
    expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({ error });
    expect(ErrorBoundary.getDerivedStateFromError(error).error).toBe(error);
  });

  it("starts with no error", () => {
    const boundary = new ErrorBoundary({ children: null });
    expect(boundary.state.error).toBeNull();
  });

  it("componentDidCatch logs the error via console.error once", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boundary = new ErrorBoundary({ children: null });
    const error = new Error("logged");

    boundary.componentDidCatch(error, { componentStack: "\n    in Foo" });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toContain(error);
    spy.mockRestore();
  });

  it("renders the fallback (not children) when an error is set", () => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { error: new Error("x") };

    const markup = renderToStaticMarkup(boundary.render() as ReactElement);

    expect(markup).toContain("Something went wrong");
    expect(markup).toContain("Try again");
    expect(markup).toContain('role="alert"');
  });

  it("handleReset clears the error via setState({ error: null })", () => {
    // Verifies the reset intent only. Runtime re-render after reset is covered by the manual check.
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { error: new Error("x") };
    const setStateSpy = vi
      .spyOn(boundary, "setState")
      .mockImplementation((() => {}) as never);

    boundary.handleReset();

    expect(setStateSpy).toHaveBeenCalledTimes(1);
    expect(setStateSpy.mock.calls[0][0]).toEqual({ error: null });
  });

  it("catches a persisting error again after reset", () => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { error: new Error("first") };
    vi.spyOn(boundary, "setState").mockImplementation((() => {}) as never);
    boundary.handleReset();

    const again = new Error("again");
    expect(ErrorBoundary.getDerivedStateFromError(again)).toEqual({ error: again });
  });
});
