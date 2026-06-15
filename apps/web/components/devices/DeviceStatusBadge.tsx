"use client";
import React from "react";

export type DeviceStatus = "available" | "borrowed" | "maintenance" | "lost";

const CFG: Record<DeviceStatus, { bg: string; color: string; label: string }> =
  {
    available: { bg: "#dcfce7", color: "#15803d", label: "Tersedia" },
    borrowed: { bg: "#dbeafe", color: "#1d4ed8", label: "Dipinjam" },
    maintenance: { bg: "#fef9c3", color: "#a16207", label: "Perawatan" },
    lost: { bg: "#fee2e2", color: "#b91c1c", label: "Hilang" },
  };

export default function DeviceStatusBadge({
  status,
}: {
  status: DeviceStatus;
}) {
  const { bg, color, label } = CFG[status] ?? CFG.available;
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: bg,
        color,
      }}
    >
      {label}
    </span>
  );
}
