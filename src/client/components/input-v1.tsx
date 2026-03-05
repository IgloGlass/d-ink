import { type InputHTMLAttributes, forwardRef } from "react";

type InputSizeV1 = "md" | "sm";
type InputToneV1 = "default" | "shell";

type InputV1Props = InputHTMLAttributes<HTMLInputElement> & {
  aiFilled?: boolean;
  size?: InputSizeV1;
  tone?: InputToneV1;
  invalid?: boolean;
};

export const InputV1 = forwardRef<HTMLInputElement, InputV1Props>(
  function InputV1(
    {
      className,
      aiFilled = false,
      size = "md",
      tone = "default",
      invalid = false,
      ...rest
    },
    ref,
  ) {
    const classes = ["input-v1", `input-v1--${size}`];
    if (aiFilled) {
      classes.push("input-v1--ai");
    }
    if (tone === "shell") {
      classes.push("input-v1--shell");
      classes.push("input-v1--tone-shell");
    }
    if (className) {
      classes.push(className);
    }

    return (
      <input
        ref={ref}
        className={classes.join(" ")}
        data-ai-filled={aiFilled ? "true" : "false"}
        data-size={size}
        data-tone={tone}
        data-invalid={invalid ? "true" : "false"}
        aria-invalid={invalid}
        {...rest}
      />
    );
  },
);

InputV1.displayName = "InputV1";
