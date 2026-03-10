import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  errorMessage: string | null;
};

/**
 * Keep local dev/test failures visible instead of collapsing into a blank page.
 * This is a UI safety boundary only; it must not replace structured server errors.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      errorMessage: error.message || "Unknown client error.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[client.error_boundary]", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
            backgroundColor: "var(--color-bg-app)",
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-family-base)",
          }}
        >
          <section
            className="card-v1 card-v1--hero"
            style={{
              width: "min(720px, 100%)",
              padding: "32px",
            }}
          >
            <div className="micro-label" style={{ marginBottom: "8px" }}>
              Local Tester Mode
            </div>
            <h1
              style={{
                margin: "0 0 8px 0",
                fontSize: "30px",
                lineHeight: 1.1,
              }}
            >
              The app hit a client error
            </h1>
            <p style={{ margin: "0 0 16px 0", color: "var(--color-text-secondary)" }}>
              This screen replaces a blank page so local testing can continue with a visible failure.
            </p>
            <div
              style={{
                padding: "12px 16px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface-muted)",
                fontFamily: "var(--font-family-mono)",
                fontSize: "14px",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {this.state.errorMessage}
            </div>
            <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
              <button
                className="btn-v1 btn-v1--black"
                type="button"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
              <button
                className="btn-v1 btn-v1--secondary"
                type="button"
                onClick={() => {
                  window.location.assign("/app/workspaces");
                }}
              >
                Return to company landing
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
