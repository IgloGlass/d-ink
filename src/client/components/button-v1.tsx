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
  busy?: boolean;
};

export const ButtonV1 = forwardRef<HTMLButtonElement, ButtonV1Props>(
  function ButtonV1(
    {
      children,
      variant = "secondary",
      size = "md",
      tone = "default",
      pressed,
      busy = false,
      className,
      type = "button",
      disabled,
      ...rest
    },
    ref,
  ) {
    // Shell controls stay on the compact control rhythm used in the fixed header.
    const resolvedSize = tone === "shell" ? "sm" : size;
    const classes = [
      "btn-v1",
      `btn-v1--${variant}`,
      `btn-v1--${resolvedSize}`,
      `btn-v1--tone-${tone}`,
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
        className={classes.join(" ")}
        data-size={resolvedSize}
        data-variant={variant}
        data-tone={tone}
        data-pressed={pressed ? "true" : "false"}
        data-busy={busy ? "true" : "false"}
        aria-pressed={pressed}
        aria-busy={busy}
        disabled={disabled || busy}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

ButtonV1.displayName = "ButtonV1";
