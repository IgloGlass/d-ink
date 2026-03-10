import { useQuery } from "@tanstack/react-query";

import { StatusPill } from "./status-pill";
import {
  listCommentsV1,
  listTasksV1,
  type WorkspaceStatusV1,
} from "../lib/http/workspace-api";

export function WorkspaceReviewPanelV1({
  recommendedNextAction,
  tenantId,
  warning,
  workspaceId,
  workspaceStatus,
}: {
  recommendedNextAction: string;
  tenantId: string;
  warning: string | null;
  workspaceId: string;
  workspaceStatus: WorkspaceStatusV1;
}) {
  const commentsQuery = useQuery({
    queryKey: ["workspace-comments", tenantId, workspaceId],
    queryFn: () => listCommentsV1({ tenantId, workspaceId }),
    retry: false,
  });

  const tasksQuery = useQuery({
    queryKey: ["workspace-tasks", tenantId, workspaceId],
    queryFn: () => listTasksV1({ tenantId, workspaceId }),
    retry: false,
  });

  const latestComments = commentsQuery.data?.comments.slice(0, 3) ?? [];
  const latestTasks = tasksQuery.data?.tasks.slice(0, 3) ?? [];
  const openTaskCount =
    tasksQuery.data?.tasks.filter((task) => task.status === "open").length ?? 0;

  return (
    <aside className="review-panel">
      <section className="review-panel__section">
        <div className="review-panel__eyebrow">Workspace status</div>
        <StatusPill status={workspaceStatus} />
      </section>

      <section className="review-panel__section">
        <div className="review-panel__eyebrow">Recommended next action</div>
        <div className="review-panel__action">{recommendedNextAction}</div>
      </section>

      <section className="review-panel__section">
        <div className="review-panel__eyebrow">Blockers and warnings</div>
        <div className="review-panel__message">
          {warning ?? "No workflow blockers are currently detected."}
        </div>
      </section>

      <section className="review-panel__section">
        <div className="review-panel__header-row">
          <div className="review-panel__eyebrow">Tasks</div>
          <strong>{openTaskCount} open</strong>
        </div>
        {tasksQuery.isSuccess && latestTasks.length > 0 ? (
          <ul className="review-panel__list">
            {latestTasks.map((task) => (
              <li key={task.id} className="review-panel__list-item">
                <span>{task.title}</span>
                <small>{task.status}</small>
              </li>
            ))}
          </ul>
        ) : (
          <div className="review-panel__message">No recent tasks.</div>
        )}
      </section>

      <section className="review-panel__section">
        <div className="review-panel__header-row">
          <div className="review-panel__eyebrow">Comments</div>
          <strong>{commentsQuery.data?.comments.length ?? 0}</strong>
        </div>
        {commentsQuery.isSuccess && latestComments.length > 0 ? (
          <ul className="review-panel__list">
            {latestComments.map((comment) => (
              <li key={comment.id} className="review-panel__list-item">
                <span>{comment.body}</span>
                <small>{new Date(comment.createdAt).toLocaleDateString()}</small>
              </li>
            ))}
          </ul>
        ) : (
          <div className="review-panel__message">No recent comments.</div>
        )}
      </section>
    </aside>
  );
}
