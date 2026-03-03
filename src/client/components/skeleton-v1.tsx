export function SkeletonV1({
  height = 16,
  width = "100%",
}: {
  height?: number;
  width?: number | string;
}) {
  return (
    <div aria-hidden="true" className="skeleton-v1" style={{ height, width }} />
  );
}
