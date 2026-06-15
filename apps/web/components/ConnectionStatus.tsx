import React from "react";
import type { MqttStatus } from "../hooks/useMqtt";

interface ConnectionStatusProps {
  status: MqttStatus;
}

const STATUS_CONFIG: Record<
  MqttStatus,
  { color: string; bg: string; label: string }
> = {
  connected: {
    color: "var(--success-600)",
    bg: "var(--success-50)",
    label: "Live",
  },
  disconnected: {
    color: "var(--danger-600)",
    bg: "var(--danger-50)",
    label: "Terputus",
  },
  reconnecting: {
    color: "var(--warning-600)",
    bg: "var(--warning-50)",
    label: "Menyambung",
  },
};

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const { color, bg, label } = STATUS_CONFIG[status];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 20,
        background: bg,
        border: `1px solid ${color}33`,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
          display: "inline-block",
          animation:
            status === "reconnecting"
              ? "pulse 1.5s infinite"
              : status === "connected"
                ? "pulse 2s infinite"
                : "none",
          boxShadow: status === "connected" ? `0 0 8px ${color}` : "none",
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
    </div>
  );
}
