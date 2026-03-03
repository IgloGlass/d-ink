import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariantV1 = "primary" | "secondary" | "icon";

export function ButtonV1({
  children,
  variant = "secondary",
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariantV1;
}) {
  const classes = ["btn-v1"];
  if (variant === "primary") {
    classes.push("btn-v1--primary");
  }
  if (variant === "icon") {
    classes.push("btn-v1--icon");
  }
  if (className) {
    classes.push(className);
  }

  return (
    <button type={type} className={classes.join(" ")} {...rest}>
      {children}
    </button>
  );
}
