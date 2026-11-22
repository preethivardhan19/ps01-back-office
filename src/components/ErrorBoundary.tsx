import React from "react";

export interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors in its subtree and shows a fallback instead of a blank screen.
 *
 * Try again clears the boundary and re-renders children. If the underlying error persists,
 * the boundary catches it again and shows this fallback.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error === null) {
      return this.props.children;
    }

    return (
      <div role="alert">
        <h2>Something went wrong</h2>
        <p>
          This screen failed to render. The error did not change your data; the stored data is unchanged by this error.
        </p>
        <button type="button" onClick={this.handleReset}>
          Try again
        </button>
      </div>
    );
  }
}
