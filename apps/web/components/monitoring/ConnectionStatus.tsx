"use client";
import React from "react";
import type { MqttStatus } from "../../hooks/useMonitoringMqtt";

const CFG: Record<MqttStatus, { color: string; label: string; spin: boolean }> =
  {
    connected: { color: "#16a34a", label: "Connected", spin: false },
    disconnected: { color: "#dc2626", label: "Disconnected", spin: false },
    reconnecting: { color: "#d97706", label: "Reconnecting...", spin: true },
  };

export default function ConnectionStatus({ status }: { status: MqttStatus }) {
  const { color, label, spin } = CFG[status];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 8,
        background: `${color}12`,
        border: `1px solid ${color}33`,
      }}
    >
      {spin ? (
        <span
          style={{
            width: 9,
            height: 9,
            border: `2px solid ${color}`,
            borderTopColor: "transparent",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
          }}
        />
      ) : (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            boxShadow: status === "connected" ? `0 0 6px ${color}` : "none",
          }}
        />
      )}
      <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
    </div>
  );
}
