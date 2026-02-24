import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NavLink, useNavigate } from "react-router-dom";

import { useThemeMode } from "../app/providers";
import { toUserFacingErrorMessage } from "../lib/http/api-client";
import {
  type SessionPrincipalV1,
  currentSessionQueryKeyV1,
  logoutSessionV1,
} from "../lib/http/auth-api";

export function AppShell({
  children,
  principal,
}: {
  children: React.ReactNode;
  principal: SessionPrincipalV1;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mode, toggleMode } = useThemeMode();

  const logoutMutation = useMutation({
    mutationFn: logoutSessionV1,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: currentSessionQueryKeyV1,
      });
      navigate("/");
    },
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/">
          D.ink
          <span className="brand-dot" aria-hidden="true" />
        </a>

        <nav className="main-nav" aria-label="Primary">
          <NavLink to="/app/workspaces">Workspaces</NavLink>
          {principal.role === "Admin" ? (
            <NavLink to="/app/invite">Invite</NavLink>
          ) : null}
        </nav>

        <div className="header-actions">
          <div className="tenant-badge" title={principal.tenantId}>
            <span>{principal.role}</span>
            <span>{principal.tenantId.slice(0, 8)}</span>
          </div>

          <button type="button" className="secondary" onClick={toggleMode}>
            Theme: {mode === "light" ? "Light" : "Dark"}
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? "Logging out..." : "Logout"}
          </button>
        </div>
      </header>

      {logoutMutation.isError ? (
        <p className="error-text" role="alert">
          {toUserFacingErrorMessage(logoutMutation.error)}
        </p>
      ) : null}

      <main className="app-main">{children}</main>
    </div>
  );
}
