import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLocation,
  useParams,
} from "react-router-dom";

import { AppShell } from "../components/app-shell";
import { InvitePage } from "../features/auth/invite-page";
import { SessionGate } from "../features/auth/session-gate";
import { GroupControlPanelPageV1 } from "../features/groups/group-control-panel-page.v1";
import { CoreModuleShellPageV1 } from "../features/modules/core-module-shell-page.v1";
import { CompanySelectorPageV1 } from "../features/workspaces/company-selector-page.v1";
import { WorkspaceDetailPage } from "../features/workspaces/workspace-detail-page";
import { WorkspaceWorkbenchPageV1 } from "../features/workspaces/workspace-workbench-page.v1";
import { toUserFacingErrorMessage } from "../lib/http/api-client";
import {
  currentSessionQueryKeyV1,
  fetchCurrentSessionV1,
} from "../lib/http/auth-api";
import { useGlobalAppContextV1 } from "./app-context.v1";

const appWorkspaceHomePathV1 = "/app/workspaces";
const defaultGroupControlPanelPathV1 = "/app/groups/default/control-panel";
const legacyWorkspaceWorkbenchPathsV1 = new Set([
  "",
  "workbench",
  "workspace",
  "workspace-home",
  "home",
  "overview",
]);
const legacyWorkspaceDetailPathsV1 = new Set([
  "detail",
  "workspace-detail",
  "legacy-detail",
]);

function ProtectedLayoutV1() {
  const location = useLocation();
  const { activeWorkspaceId, setActiveContext } = useGlobalAppContextV1();
  const currentSessionQuery = useQuery({
    queryKey: currentSessionQueryKeyV1,
    queryFn: fetchCurrentSessionV1,
  });

  useEffect(() => {
    const workspaceMatch = location.pathname.match(
      /^\/app\/workspaces\/([^/]+)(?:\/|$)/,
    );
    const workspaceIdFromPath = workspaceMatch?.[1] ?? null;
    if (!workspaceIdFromPath || workspaceIdFromPath === activeWorkspaceId) {
      return;
    }

    // Keep launcher context in sync for direct URL and legacy-route entry.
    setActiveContext({ activeWorkspaceId: workspaceIdFromPath });
  }, [activeWorkspaceId, location.pathname, setActiveContext]);

  if (currentSessionQuery.isPending) {
    return <div className="card">Checking your session...</div>;
  }

  if (currentSessionQuery.isError) {
    return (
      <div className="card">
        <h1>Sign-in required</h1>
        <p>{toUserFacingErrorMessage(currentSessionQuery.error)}</p>
        <p>Open a valid magic-link invite URL to sign in.</p>
      </div>
    );
  }

  return (
    <AppShell principal={currentSessionQuery.data.principal}>
      <Outlet context={currentSessionQuery.data.principal} />
    </AppShell>
  );
}

function LegacyWorkspaceWorkbenchRedirectV1() {
  const { workspaceId } = useParams();
  if (!workspaceId) {
    return <Navigate replace to={appWorkspaceHomePathV1} />;
  }

  return <Navigate replace to={`/app/workspaces/${workspaceId}/workbench`} />;
}

function toLegacyWorkspaceDestinationV1(
  legacySubPath: string | undefined,
): string {
  const normalizedPath = (legacySubPath ?? "").replace(/^\/+|\/+$/g, "");
  const normalizedAlias = normalizedPath.toLowerCase();

  if (legacyWorkspaceWorkbenchPathsV1.has(normalizedAlias)) {
    return "workbench";
  }

  if (legacyWorkspaceDetailPathsV1.has(normalizedAlias)) {
    return "legacy-detail";
  }

  return normalizedPath;
}

function LegacyWorkspaceRedirectV1() {
  const { workspaceId, "*": legacySubPath } = useParams();
  if (!workspaceId) {
    return <Navigate replace to={appWorkspaceHomePathV1} />;
  }

  // Preserve deep links from pre-IA routes while normalizing detail aliases.
  const destination = toLegacyWorkspaceDestinationV1(legacySubPath);
  return (
    <Navigate replace to={`/app/workspaces/${workspaceId}/${destination}`} />
  );
}

function LegacyWorkspaceDetailRedirectV1() {
  const { workspaceId } = useParams();
  if (!workspaceId) {
    return <Navigate replace to={appWorkspaceHomePathV1} />;
  }

  return (
    <Navigate replace to={`/app/workspaces/${workspaceId}/legacy-detail`} />
  );
}

function LegacyWorkspaceAppFallbackRedirectV1() {
  const { workspaceId, "*": legacySubPath } = useParams();
  if (!workspaceId) {
    return <Navigate replace to={appWorkspaceHomePathV1} />;
  }

  // Unknown deep workspace paths should recover to workbench instead of app root.
  const destination = toLegacyWorkspaceDestinationV1(legacySubPath);
  const canonicalDestination =
    destination === "legacy-detail" || destination === "workbench"
      ? destination
      : "workbench";

  return (
    <Navigate
      replace
      to={`/app/workspaces/${workspaceId}/${canonicalDestination}`}
    />
  );
}

function LegacyGroupControlPanelRedirectV1() {
  const { groupId } = useParams();
  if (!groupId) {
    return <Navigate replace to={defaultGroupControlPanelPathV1} />;
  }

  return <Navigate replace to={`/app/groups/${groupId}/control-panel`} />;
}

function NotFoundPageV1() {
  return (
    <div className="card">
      <h1>Not found</h1>
      <p>This route is not available in V1.</p>
    </div>
  );
}

const routerV1 = createBrowserRouter(
  [
    {
      path: "/",
      element: <SessionGate />,
    },
    {
      path: "/workspace",
      element: <Navigate replace to={appWorkspaceHomePathV1} />,
    },
    {
      path: "/workspace/:workspaceId/*",
      element: <LegacyWorkspaceRedirectV1 />,
    },
    {
      path: "/workspaces",
      element: <Navigate replace to={appWorkspaceHomePathV1} />,
    },
    {
      path: "/workspaces/:workspaceId/*",
      element: <LegacyWorkspaceRedirectV1 />,
    },
    {
      path: "/group",
      element: <Navigate replace to={defaultGroupControlPanelPathV1} />,
    },
    {
      path: "/group/:groupId/*",
      element: <LegacyGroupControlPanelRedirectV1 />,
    },
    {
      path: "/groups",
      element: <Navigate replace to={defaultGroupControlPanelPathV1} />,
    },
    {
      path: "/groups/:groupId/*",
      element: <LegacyGroupControlPanelRedirectV1 />,
    },
    {
      path: "/invite",
      element: <Navigate replace to="/app/invite" />,
    },
    {
      path: "/invites",
      element: <Navigate replace to="/app/invite" />,
    },
    {
      path: "/app",
      element: <ProtectedLayoutV1 />,
      children: [
        {
          index: true,
          element: <Navigate replace to={appWorkspaceHomePathV1} />,
        },
        {
          path: "workspaces",
          element: <CompanySelectorPageV1 />,
        },
        {
          path: "workspace",
          element: <Navigate replace to={appWorkspaceHomePathV1} />,
        },
        {
          path: "workspace/:workspaceId/*",
          element: <LegacyWorkspaceRedirectV1 />,
        },
        {
          path: "workspaces/:workspaceId",
          element: <LegacyWorkspaceWorkbenchRedirectV1 />,
        },
        {
          path: "workspaces/:workspaceId/workbench",
          element: <WorkspaceWorkbenchPageV1 />,
        },
        {
          path: "workspaces/:workspaceId/detail",
          element: <LegacyWorkspaceDetailRedirectV1 />,
        },
        {
          path: "workspaces/:workspaceId/workspace-detail",
          element: <LegacyWorkspaceDetailRedirectV1 />,
        },
        {
          path: "workspaces/:workspaceId/legacy-detail",
          element: <WorkspaceDetailPage />,
        },
        {
          path: "workspaces/:workspaceId/:coreModule/:subModule",
          element: <CoreModuleShellPageV1 />,
        },
        {
          path: "workspaces/:workspaceId/:coreModule",
          element: <CoreModuleShellPageV1 />,
        },
        {
          path: "workspaces/:workspaceId/*",
          element: <LegacyWorkspaceAppFallbackRedirectV1 />,
        },
        {
          path: "groups/:groupId/control-panel",
          element: <GroupControlPanelPageV1 />,
        },
        {
          path: "groups",
          element: <Navigate replace to={defaultGroupControlPanelPathV1} />,
        },
        {
          path: "groups/:groupId/*",
          element: <LegacyGroupControlPanelRedirectV1 />,
        },
        {
          path: "group",
          element: <Navigate replace to={defaultGroupControlPanelPathV1} />,
        },
        {
          path: "group/:groupId/*",
          element: <LegacyGroupControlPanelRedirectV1 />,
        },
        {
          path: "invite",
          element: <InvitePage />,
        },
        {
          path: "invites",
          element: <Navigate replace to="/app/invite" />,
        },
        // Keep authenticated users on a valid IA route instead of a dead-end view.
        {
          path: "*",
          element: <Navigate replace to={appWorkspaceHomePathV1} />,
        },
      ],
    },
    {
      path: "*",
      element: <NotFoundPageV1 />,
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  },
);

export function AppRouter() {
  return (
    <RouterProvider
      router={routerV1}
      future={{
        v7_startTransition: true,
      }}
    />
  );
}
