import React from "react";
import type { MqttStatus } from "../hooks/useMqtt";

interface ConnectionStatusProps {
  status: MqttStatus;
}

const STATUS_CONFIG: Record<MqttStatus, { color: string; label: string }> = {
  connected: { color: "#16a34a", label: "Terhubung" },
  disconnected: { color: "#dc2626", label: "Terputus" },
  reconnecting: { color: "#ca8a04", label: "Menyambung kembali..." },
};

/**
 * Visual MQTT connection indicator.
 * Green = connected, Red = disconnected, Yellow = reconnecting.
 * Requirements: 13.7
 */
export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const { color, label } = STATUS_CONFIG[status];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: color,
          display: "inline-block",
        }}
        aria-hidden="true"
      />
      <span style={{ fontSize: 13, color }}>{label}</span>
    </div>
  );
}
