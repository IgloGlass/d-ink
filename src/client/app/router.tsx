import { useQuery } from "@tanstack/react-query";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
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

function ProtectedLayoutV1() {
  const currentSessionQuery = useQuery({
    queryKey: currentSessionQueryKeyV1,
    queryFn: fetchCurrentSessionV1,
  });

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

function NotFoundPageV1() {
  return (
    <div className="card">
      <h1>Not found</h1>
      <p>This route is not available in V1.</p>
    </div>
  );
}

const routerV1 = createBrowserRouter([
  {
    path: "/",
    element: <SessionGate />,
  },
  {
    path: "/app",
    element: <ProtectedLayoutV1 />,
    children: [
      {
        index: true,
        element: <Navigate replace to="/app/workspaces" />,
      },
      {
        path: "workspaces",
        element: <CompanySelectorPageV1 />,
      },
      {
        path: "workspaces/:workspaceId",
        element: <Navigate replace to="workbench" />,
      },
      {
        path: "workspaces/:workspaceId/workbench",
        element: <WorkspaceWorkbenchPageV1 />,
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
        path: "groups/:groupId/control-panel",
        element: <GroupControlPanelPageV1 />,
      },
      {
        path: "invite",
        element: <InvitePage />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPageV1 />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={routerV1} />;
}
