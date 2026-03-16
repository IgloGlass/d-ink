import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import {
  ApiClientError,
  toUserFacingErrorMessage,
} from "../../lib/http/api-client";
import {
  currentSessionQueryKeyV1,
  fetchCurrentSessionV1,
  startDevSessionV1,
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

function isLocalDevHostV1(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

const ONLINE_DEMO_AUTO_SIGNIN_PARAM_V1 = "demo";
const ONLINE_DEMO_AUTO_SIGNIN_STORAGE_KEY_V1 = "dink_demo_auto_signin_v1";

function shouldEnableOnlineDemoAutoSigninV1(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get(ONLINE_DEMO_AUTO_SIGNIN_PARAM_V1) === "1") {
      window.sessionStorage.setItem(ONLINE_DEMO_AUTO_SIGNIN_STORAGE_KEY_V1, "1");
      return true;
    }

    return (
      window.sessionStorage.getItem(ONLINE_DEMO_AUTO_SIGNIN_STORAGE_KEY_V1) ===
      "1"
    );
  } catch {
    return false;
  }
}

export function SessionGate() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [hasAttemptedAutoLogin, setHasAttemptedAutoLogin] = useState(false);

  const devLoginMutation = useMutation({
    mutationFn: async () => startDevSessionV1({ role: "Admin" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: currentSessionQueryKeyV1,
      });
    },
  });

  const sessionQuery = useQuery({
    queryKey: currentSessionQueryKeyV1,
    queryFn: fetchCurrentSessionV1,
  });

  const shouldAutoDevLogin =
    isLocalDevHostV1() || shouldEnableOnlineDemoAutoSigninV1();
  const isSessionApiError =
    sessionQuery.isError && sessionQuery.error instanceof ApiClientError;
  const sessionApiError = isSessionApiError
    ? (sessionQuery.error as ApiClientError)
    : null;
  const sessionMissingOrExpired = Boolean(
    sessionApiError &&
      (sessionApiError.code === "SESSION_MISSING" ||
        sessionApiError.code === "SESSION_INVALID_OR_EXPIRED"),
  );
  const shouldAttemptLocalDevRecovery =
    shouldAutoDevLogin &&
    isSessionApiError &&
    !devLoginMutation.isPending &&
    !hasAttemptedAutoLogin;

  useEffect(() => {
    if (!shouldAttemptLocalDevRecovery) {
      return;
    }

    // Temporary V1 demo mode: auto-establish Admin session in local dev.
    setHasAttemptedAutoLogin(true);
    devLoginMutation.mutate();
  }, [
    devLoginMutation,
    hasAttemptedAutoLogin,
    shouldAttemptLocalDevRecovery,
  ]);

  if (sessionQuery.isPending) {
    return (
      <CardV1 className="auth-card">
        <div className="panel-stack">
          <SkeletonV1 width={120} height={24} />
          <SkeletonV1 width="80%" height={16} />
          <SkeletonV1 width="72%" height={16} />
          <SkeletonV1 height={36} />
        </div>
      </CardV1>
    );
  }

  if (sessionQuery.isSuccess) {
    return <Navigate replace to="/app/workspaces" />;
  }

  const isAutoSigningIn =
    shouldAutoDevLogin &&
    isSessionApiError &&
    (!hasAttemptedAutoLogin || devLoginMutation.isPending);
  if (isAutoSigningIn) {
    return (
      <CardV1 className="auth-card">
        <div className="panel-stack">
          <h1>D.ink</h1>
          <p>Starting automatic demo admin session...</p>
          <SkeletonV1 width="80%" height={16} />
          <SkeletonV1 width="72%" height={16} />
          <SkeletonV1 height={36} />
        </div>
      </CardV1>
    );
  }

  if (shouldAutoDevLogin && devLoginMutation.isError) {
    return (
      <CardV1 className="auth-card">
        <h1>D.ink</h1>
        <EmptyStateV1
          title="Automatic demo sign-in failed"
          description={toUserFacingErrorMessage(devLoginMutation.error)}
          tone="error"
          role="alert"
          action={
            <ButtonV1
              variant="primary"
              onClick={() => {
                setHasAttemptedAutoLogin(true);
                devLoginMutation.mutate();
              }}
            >
              Retry automatic sign-in
            </ButtonV1>
          }
        />
      </CardV1>
    );
  }

  const authErrorHint = toAuthErrorHintV1(location.search);
  const defaultMessage = toUserFacingErrorMessage(sessionQuery.error);
  const shouldShowApiMessage =
    sessionQuery.error instanceof ApiClientError &&
    !shouldAutoDevLogin;

  return (
    <CardV1 className="auth-card">
      <h1>D.ink</h1>
      <p>AI-powered Swedish tax return assistant for accountants.</p>
      {authErrorHint ? (
        <EmptyStateV1
          title="Sign-in error"
          description={authErrorHint}
          tone="error"
          role="alert"
        />
      ) : null}
      {shouldShowApiMessage ? (
        <EmptyStateV1
          title="Session unavailable"
          description={defaultMessage}
          tone="error"
          role="alert"
        />
      ) : null}
      {!shouldAutoDevLogin ? (
        <p>Demo auto sign-in is available on localhost or with `?demo=1`.</p>
      ) : null}
    </CardV1>
  );
}
