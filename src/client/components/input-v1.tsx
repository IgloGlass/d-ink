import type { InputHTMLAttributes } from "react";

export function InputV1({
  className,
  aiFilled = false,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  aiFilled?: boolean;
}) {
  const classes = ["input-v1"];
  if (aiFilled) {
    classes.push("input-v1--ai");
  }
  if (className) {
    classes.push(className);
  }

  return <input className={classes.join(" ")} {...rest} />;
}
