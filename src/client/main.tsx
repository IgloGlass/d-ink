import React from "react";
import ReactDOM from "react-dom/client";

import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";
import { AppErrorBoundary } from "./components/app-error-boundary";
import "./styles/tokens.css";
import "./styles/global.css";

function installGlobalClientErrorCaptureV1(): void {
  if (typeof window === "undefined") {
    return;
  }
  if ((window as { __dinkGlobalErrorCaptureV1?: boolean }).__dinkGlobalErrorCaptureV1) {
    return;
  }

  (window as { __dinkGlobalErrorCaptureV1?: boolean }).__dinkGlobalErrorCaptureV1 =
    true;
  window.addEventListener("error", (event) => {
    console.error("[client.window_error]", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error:
        event.error instanceof Error
          ? {
              message: event.error.message,
              stack: event.error.stack,
            }
          : null,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    console.error("[client.unhandled_rejection]", {
      reason:
        reason instanceof Error
          ? {
              message: reason.message,
              stack: reason.stack,
            }
          : reason,
    });
  });
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Unable to find root element for D.ink frontend.");
}

installGlobalClientErrorCaptureV1();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </AppErrorBoundary>
  </React.StrictMode>,
);
