import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";

import {
  ApiClientError,
  toUserFacingErrorMessage,
} from "../../lib/http/api-client";
import {
  currentSessionQueryKeyV1,
  fetchCurrentSessionV1,
} from "../../lib/http/auth-api";

function toAuthErrorHintV1(search: string): string | null {
  const params = new URLSearchParams(search);
  if (params.get("auth") !== "error") {
    return null;
  }

  const code = params.get("code");
  if (!code) {
    return "Sign-in failed. Please request a new magic link.";
  }

  if (code === "TOKEN_INVALID_OR_EXPIRED") {
    return "This magic link is invalid or expired. Ask an Admin for a new invite.";
  }

  return `Sign-in failed (${code}).`;
}

export function SessionGate() {
  const location = useLocation();
  const sessionQuery = useQuery({
    queryKey: currentSessionQueryKeyV1,
    queryFn: fetchCurrentSessionV1,
  });

  if (sessionQuery.isPending) {
    return <div className="card">Checking your session...</div>;
  }

  if (sessionQuery.isSuccess) {
    return <Navigate replace to="/app/workspaces" />;
  }

  const authErrorHint = toAuthErrorHintV1(location.search);
  const defaultMessage = toUserFacingErrorMessage(sessionQuery.error);
  const shouldShowApiMessage =
    sessionQuery.error instanceof ApiClientError &&
    sessionQuery.error.code !== "SESSION_MISSING";

  return (
    <div className="card auth-card">
      <h1>D.ink</h1>
      <p>AI-powered Swedish tax return assistant for accountants.</p>
      <p>Open your invite magic link to sign in.</p>
      {authErrorHint ? (
        <p className="error-text" role="alert">
          {authErrorHint}
        </p>
      ) : null}
      {shouldShowApiMessage ? (
        <p className="error-text" role="alert">
          {defaultMessage}
        </p>
      ) : null}
    </div>
  );
}
