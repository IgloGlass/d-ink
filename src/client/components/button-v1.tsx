import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

type ButtonVariantV1 = "primary" | "secondary" | "icon" | "black";
type ButtonSizeV1 = "md" | "sm";

type ButtonV1Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariantV1;
  size?: ButtonSizeV1;
  busy?: boolean;
};

export const ButtonV1 = forwardRef<HTMLButtonElement, ButtonV1Props>(
  function ButtonV1(
    {
      children,
      variant = "secondary",
      size = "md",
      busy = false,
      className,
      type = "button",
      disabled,
      ...rest
    },
    ref,
  ) {
    const classes = [
      "btn-v1",
      `btn-v1--${variant}`,
      size === "sm" ? "btn-v1--sm" : "",
    ];
    if (className) {
      classes.push(className);
    }
    if (busy) {
      classes.push("btn-v1--busy");
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classes.join(" ").trim()}
        disabled={disabled || busy}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

ButtonV1.displayName = "ButtonV1";
