import React from "react";
import HRZoneBadge, { HRZone } from "./HRZoneBadge";

export interface HRData {
  hr: number;
  zone: HRZone;
  timestamp: number;
}

interface HRMonitorProps {
  memberId: string;
  memberName: string;
  hrData: HRData | null;
}

/**
 * Displays real-time HR value, zone, and zone color badge for a single member.
 * Updates in < 1 second when new MQTT data arrives (driven by parent state).
 * Requirements: 13.3
 */
export default function HRMonitor({ memberName, hrData }: HRMonitorProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <span style={{ flex: 1, fontWeight: 500 }}>{memberName}</span>

      {hrData ? (
        <>
          <span style={{ fontSize: 24, fontWeight: 700, color: "#1d4ed8" }}>
            {hrData.hr}
          </span>
          <span style={{ fontSize: 12, color: "#6b7280" }}>bpm</span>
          <HRZoneBadge zone={hrData.zone} />
        </>
      ) : (
        <span style={{ color: "#9ca3af", fontSize: 14 }}>Menunggu data...</span>
      )}
    </div>
  );
}
