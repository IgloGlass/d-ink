import type { ReactNode } from "react";

type GuidanceBannerToneV1 = "neutral" | "advisory" | "active";

type GuidanceBannerV1Props = {
  children: ReactNode;
  tone?: GuidanceBannerToneV1;
  ariaLive?: "off" | "polite" | "assertive";
};

export function GuidanceBannerV1({
  children,
  tone = "neutral",
  ariaLive = "off",
}: GuidanceBannerV1Props) {
  return (
    <div className="guidance-banner-v1" data-tone={tone} aria-live={ariaLive}>
      {children}
    </div>
  );
}
