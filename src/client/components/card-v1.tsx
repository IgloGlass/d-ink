import type { HTMLAttributes, ReactNode } from "react";

export function CardV1({
  children,
  className,
  tight = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  tight?: boolean;
} & HTMLAttributes<HTMLElement>) {
  const classes = ["card-v1"];
  if (tight) {
    classes.push("card-v1--tight");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <section className={classes.join(" ")} {...rest}>
      {children}
    </section>
  );
}
