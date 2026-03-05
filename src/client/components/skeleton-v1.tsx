export function SkeletonV1({
  height = 16,
  width = "100%",
  className,
}: {
  height?: number;
  width?: number | string;
  className?: string;
}) {
  const classes = ["skeleton-v1"];
  if (className) {
    classes.push(className);
  }

  return (
    <div
      aria-hidden="true"
      className={classes.join(" ")}
      style={{ height, width }}
    />
  );
}
