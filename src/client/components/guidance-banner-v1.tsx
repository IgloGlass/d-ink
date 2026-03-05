import type { ReactNode } from "react";

type GuidanceBannerToneV1 = "neutral" | "advisory" | "active" | "attention";

type GuidanceBannerV1Props = {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  tone?: GuidanceBannerToneV1;
  ariaLive?: "off" | "polite" | "assertive";
};

export function GuidanceBannerV1({
  title,
  children,
  action,
  tone = "neutral",
  ariaLive = "off",
}: GuidanceBannerV1Props) {
  return (
    <div className="guidance-banner-v1" data-tone={tone} aria-live={ariaLive}>
      <div className="guidance-banner-v1__body">
        {title ? <p className="guidance-banner-v1__title">{title}</p> : null}
        <div className="guidance-banner-v1__message">{children}</div>
      </div>
      {action ? (
        <div className="guidance-banner-v1__action">{action}</div>
      ) : null}
    </div>
  );
}
