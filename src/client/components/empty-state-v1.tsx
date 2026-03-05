import type { ReactNode } from "react";

export function EmptyStateV1({
  title,
  description,
  action,
  tone = "neutral",
  role,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "neutral" | "error";
  role?: "status" | "alert";
}) {
  return (
    <section className="card-v1 empty-state-v1" data-tone={tone} role={role}>
      <p className="section-title">{title}</p>
      <p className="hint-text">{description}</p>
      {action ? <div className="empty-state-v1__action">{action}</div> : null}
    </section>
  );
}
