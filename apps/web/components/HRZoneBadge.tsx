import React from "react";

export type HRZone =
  | "rest"
  | "fat_burn"
  | "cardio"
  | "aerobic"
  | "peak"
  | "unknown";

const ZONE_COLORS: Record<HRZone, { bg: string; text: string; label: string }> =
  {
    rest: { bg: "#e0f2fe", text: "#0369a1", label: "Rest" },
    fat_burn: { bg: "#dcfce7", text: "#15803d", label: "Fat Burn" },
    cardio: { bg: "#fef9c3", text: "#a16207", label: "Cardio" },
    aerobic: { bg: "#fed7aa", text: "#c2410c", label: "Aerobic" },
    peak: { bg: "#fee2e2", text: "#b91c1c", label: "Peak" },
    unknown: { bg: "#f3f4f6", text: "#6b7280", label: "Unknown" },
  };

interface HRZoneBadgeProps {
  zone: HRZone;
}

export default function HRZoneBadge({ zone }: HRZoneBadgeProps) {
  const { bg, text, label } = ZONE_COLORS[zone] ?? ZONE_COLORS.unknown;
  return (
    <span
      style={{
        backgroundColor: bg,
        color: text,
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}
