import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { StatusPill } from "./status-pill";
import { WorkspaceStatusTransitionV1 } from "./workspace-status-transition-v1";
import {
  createCommentV1,
  createTaskV1,
  completeTaskV1,
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
  onTransitionSuccess,
}: {
  recommendedNextAction: string;
  tenantId: string;
  warning: string | null;
  workspaceId: string;
  workspaceStatus: WorkspaceStatusV1;
  onTransitionSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newCommentBody, setNewCommentBody] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showSuccessToast = useCallback((message: string) => {
    setSuccessToast(message);
  }, []);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(null), 3000);
    return () => clearTimeout(timer);
  }, [successToast]);

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

  const createTaskMutation = useMutation({
    mutationFn: () =>
      createTaskV1({ tenantId, workspaceId, title: newTaskTitle }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-tasks", tenantId, workspaceId],
      });
      setNewTaskTitle("");
      showSuccessToast("Task added");
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: () =>
      createCommentV1({ tenantId, workspaceId, body: newCommentBody }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-comments", tenantId, workspaceId],
      });
      setNewCommentBody("");
      showSuccessToast("Comment posted");
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => completeTaskV1({ tenantId, workspaceId, taskId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-tasks", tenantId, workspaceId],
      });
      showSuccessToast("Task completed");
    },
  });

  const latestComments = commentsQuery.data?.comments.slice(0, 3) ?? [];
  const latestTasks = tasksQuery.data?.tasks.slice(0, 3) ?? [];
  const openTaskCount =
    tasksQuery.data?.tasks.filter((task) => task.status === "open").length ?? 0;

  return (
    <aside className="review-panel">
      {successToast ? (
        <div className="review-panel__toast" role="status" aria-live="polite">
          <span className="review-panel__toast-icon">✓</span>
          {successToast}
        </div>
      ) : null}

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
                <div className="review-panel__task-meta">
                  <small>{task.status}</small>
                  {task.status === "open" && (
                    <button
                      type="button"
                      className="review-panel__complete-btn"
                      onClick={() => completeTaskMutation.mutate(task.id)}
                    >
                      ✓
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : tasksQuery.isLoading ? (
          <div className="review-panel__message">Loading…</div>
        ) : (
          <div className="review-panel__empty-state">
            <span className="review-panel__empty-icon" aria-hidden="true">☑</span>
            <span className="review-panel__empty-text">No open tasks — add one below</span>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); createTaskMutation.mutate(); }} className="review-panel__add-form">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a task..."
            className="review-panel__add-input"
          />
          <button type="submit" disabled={!newTaskTitle.trim() || createTaskMutation.isPending} className="review-panel__add-btn">
            Add
          </button>
        </form>
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
        ) : commentsQuery.isLoading ? (
          <div className="review-panel__message">Loading…</div>
        ) : (
          <div className="review-panel__empty-state">
            <span className="review-panel__empty-icon" aria-hidden="true">💬</span>
            <span className="review-panel__empty-text">No comments yet — start the discussion</span>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); createCommentMutation.mutate(); }} className="review-panel__add-form">
          <input
            type="text"
            value={newCommentBody}
            onChange={(e) => setNewCommentBody(e.target.value)}
            placeholder="Add a comment..."
            className="review-panel__add-input"
          />
          <button type="submit" disabled={!newCommentBody.trim() || createCommentMutation.isPending} className="review-panel__add-btn">
            Post
          </button>
        </form>
      </section>

      <section className="review-panel__section">
        <div className="review-panel__eyebrow">Workflow actions</div>
        <WorkspaceStatusTransitionV1
          currentStatus={workspaceStatus}
          tenantId={tenantId}
          workspaceId={workspaceId}
          onTransitionSuccess={(newStatus) => {
            queryClient.invalidateQueries({
              queryKey: ["workspace", tenantId, workspaceId],
            });
            queryClient.invalidateQueries({
              queryKey: ["workspaces", tenantId],
            });
            showSuccessToast(`Status updated to ${newStatus.replace(/_/g, " ")}`);
            onTransitionSuccess?.();
          }}
        />
      </section>
    </aside>
  );
}
