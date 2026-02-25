import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
  useOutletContext,
} from "react-router-dom";

import { InvitePage } from "../features/auth/invite-page";
import { SessionGate } from "../features/auth/session-gate";
import { WorkspaceDetailPage } from "../features/workspaces/workspace-detail-page";
import { WorkspaceListPage } from "../features/workspaces/workspace-list-page";
import { type SessionPrincipalV1 } from "../lib/http/auth-api";

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
    element: <Navigate replace to="/app" />,
  },
  {
    path: "/app",
    element: <SessionGate />,
    children: [
      {
        index: true,
        element: <Navigate replace to="/app/workspaces" />,
      },
      {
        path: "workspaces",
        element: <WorkspaceListPage />,
      },
      {
        path: "workspaces/:workspaceId",
        element: <WorkspaceDetailPage />,
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

export function useRequiredSessionPrincipalV1(): SessionPrincipalV1 {
  return useOutletContext<SessionPrincipalV1>();
}
