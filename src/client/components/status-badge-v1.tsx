export type StatusToneV1 = "neutral" | "success" | "warning" | "attention";

export function StatusBadgeV1({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusToneV1;
}) {
  return (
    <span className="status-badge-v1" data-tone={tone}>
      <span className="status-badge-v1__dot" aria-hidden="true" />
      <span className="status-badge-v1__label">{label}</span>
    </span>
  );
}
