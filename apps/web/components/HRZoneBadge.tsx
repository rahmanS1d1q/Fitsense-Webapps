import React from "react";

export type HRZone =
  | "rest"
  | "fat_burn"
  | "cardio"
  | "aerobic"
  | "peak"
  | "unknown";

const ZONE_CONFIG: Record<
  HRZone,
  { bg: string; text: string; border: string; label: string; icon: string }
> = {
  rest: {
    bg: "#eff6ff",
    text: "#1d4ed8",
    border: "#bfdbfe",
    label: "Rest",
    icon: "💤",
  },
  fat_burn: {
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#bbf7d0",
    label: "Fat Burn",
    icon: "🔥",
  },
  cardio: {
    bg: "#fefce8",
    text: "#a16207",
    border: "#fde047",
    label: "Cardio",
    icon: "💛",
  },
  aerobic: {
    bg: "#fff7ed",
    text: "#c2410c",
    border: "#fed7aa",
    label: "Aerobic",
    icon: "🧡",
  },
  peak: {
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
    label: "Peak",
    icon: "❤️‍🔥",
  },
  unknown: {
    bg: "#f8fafc",
    text: "#64748b",
    border: "#e2e8f0",
    label: "Unknown",
    icon: "—",
  },
};

interface HRZoneBadgeProps {
  zone: HRZone;
  size?: "sm" | "md";
}

export default function HRZoneBadge({ zone, size = "sm" }: HRZoneBadgeProps) {
  const { bg, text, border, label, icon } =
    ZONE_CONFIG[zone] ?? ZONE_CONFIG.unknown;
  const isMd = size === "md";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isMd ? 6 : 4,
        backgroundColor: bg,
        color: text,
        padding: isMd ? "6px 14px" : "3px 10px",
        borderRadius: 20,
        fontSize: isMd ? 14 : 12,
        fontWeight: 600,
        border: `1px solid ${border}`,
      }}
    >
      <span>{icon}</span> {label}
    </span>
  );
}
