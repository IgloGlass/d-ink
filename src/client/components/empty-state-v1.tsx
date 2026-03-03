export function EmptyStateV1({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="card-v1">
      <p className="section-title">{title}</p>
      <p className="hint-text">{description}</p>
    </section>
  );
}
