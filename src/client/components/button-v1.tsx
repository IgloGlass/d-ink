import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

type ButtonVariantV1 = "primary" | "secondary" | "icon";
type ButtonSizeV1 = "md" | "sm";
type ButtonToneV1 = "default" | "shell";

type ButtonV1Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariantV1;
  size?: ButtonSizeV1;
  tone?: ButtonToneV1;
  pressed?: boolean;
};

export const ButtonV1 = forwardRef<HTMLButtonElement, ButtonV1Props>(
  function ButtonV1(
    {
      children,
      variant = "secondary",
      size = "md",
      tone = "default",
      pressed,
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const classes = ["btn-v1", `btn-v1--${variant}`, `btn-v1--${size}`];
    if (tone === "shell") {
      classes.push("btn-v1--shell");
      classes.push("btn-v1--tone-shell");
    }
    if (className) {
      classes.push(className);
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classes.join(" ")}
        data-size={size}
        data-variant={variant}
        data-tone={tone}
        data-pressed={pressed ? "true" : "false"}
        aria-pressed={pressed}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

ButtonV1.displayName = "ButtonV1";
