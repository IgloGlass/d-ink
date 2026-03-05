import { type InputHTMLAttributes, forwardRef } from "react";

type InputSizeV1 = "md" | "sm";
type InputToneV1 = "default" | "shell";

type InputV1Props = InputHTMLAttributes<HTMLInputElement> & {
  aiFilled?: boolean;
  size?: InputSizeV1;
  tone?: InputToneV1;
  invalid?: boolean;
  monospace?: boolean;
};

export const InputV1 = forwardRef<HTMLInputElement, InputV1Props>(
  function InputV1(
    {
      className,
      aiFilled = false,
      size = "md",
      tone = "default",
      invalid = false,
      monospace = false,
      ...rest
    },
    ref,
  ) {
    // Header/launcher inputs should always use compact shell sizing.
    const resolvedSize = tone === "shell" ? "sm" : size;
    const classes = [
      "input-v1",
      `input-v1--${resolvedSize}`,
      `input-v1--tone-${tone}`,
    ];
    if (aiFilled) {
      classes.push("input-v1--ai");
    }
    if (monospace) {
      classes.push("input-v1--mono");
    }
    if (className) {
      classes.push(className);
    }

    return (
      <input
        ref={ref}
        className={classes.join(" ")}
        data-ai-filled={aiFilled ? "true" : "false"}
        data-size={resolvedSize}
        data-tone={tone}
        data-invalid={invalid ? "true" : "false"}
        data-monospace={monospace ? "true" : "false"}
        aria-invalid={invalid}
        {...rest}
      />
    );
  },
);

InputV1.displayName = "InputV1";
