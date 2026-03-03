import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

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

const DEV_TENANT_STORAGE_KEY_V1 = "dink_dev_auth_tenant_id_v1";
const DEV_EMAIL_STORAGE_KEY_V1 = "dink_dev_auth_email_v1";
const DEV_ROLE_STORAGE_KEY_V1 = "dink_dev_auth_role_v1";

function isLocalDevHostV1(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

function readStorageValueV1(key: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(key) ?? "";
}

export function SessionGate() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [devTenantId, setDevTenantId] = useState(() =>
    readStorageValueV1(DEV_TENANT_STORAGE_KEY_V1),
  );
  const [devEmail, setDevEmail] = useState(() => {
    const value = readStorageValueV1(DEV_EMAIL_STORAGE_KEY_V1);
    return value.length > 0 ? value : "dev.user@example.com";
  });
  const [devRole, setDevRole] = useState<"Admin" | "Editor">(() => {
    const value = readStorageValueV1(DEV_ROLE_STORAGE_KEY_V1);
    return value === "Editor" ? "Editor" : "Admin";
  });

  const devLoginMutation = useMutation({
    mutationFn: async () =>
      startDevSessionV1({
        tenantId:
          devTenantId.trim().length > 0 ? devTenantId.trim() : undefined,
        email: devEmail.trim().length > 0 ? devEmail.trim() : undefined,
        role: devRole,
      }),
    onSuccess: async () => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DEV_TENANT_STORAGE_KEY_V1, devTenantId);
        window.localStorage.setItem(DEV_EMAIL_STORAGE_KEY_V1, devEmail);
        window.localStorage.setItem(DEV_ROLE_STORAGE_KEY_V1, devRole);
      }

      await queryClient.invalidateQueries({
        queryKey: currentSessionQueryKeyV1,
      });
    },
  });

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
  const shouldShowDevLogin = isLocalDevHostV1();

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
      {shouldShowDevLogin ? (
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            devLoginMutation.mutate();
          }}
        >
          <h2>Quick dev sign-in</h2>
          <label>
            Tenant ID
            <input
              type="text"
              value={devTenantId}
              placeholder="UUIDv4 or short ID (e.g. 5335)"
              onChange={(event) => setDevTenantId(event.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={devEmail}
              onChange={(event) => setDevEmail(event.target.value)}
            />
          </label>
          <label>
            Role
            <select
              value={devRole}
              onChange={(event) =>
                setDevRole(event.target.value as "Admin" | "Editor")
              }
            >
              <option value="Admin">Admin</option>
              <option value="Editor">Editor</option>
            </select>
          </label>
          <button
            type="submit"
            className="secondary"
            disabled={devLoginMutation.isPending}
          >
            {devLoginMutation.isPending
              ? "Signing in..."
              : "Sign in for local testing"}
          </button>
          {devLoginMutation.isError ? (
            <p className="error-text" role="alert">
              {toUserFacingErrorMessage(devLoginMutation.error)}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
