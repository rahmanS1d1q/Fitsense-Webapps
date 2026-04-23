"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useMqtt } from "../../../hooks/useMqtt";
import HRZoneBadge, { HRZone } from "../../../components/HRZoneBadge";
import AlertBanner, { Alert } from "../../../components/AlertBanner";
import ConnectionStatus from "../../../components/ConnectionStatus";

/**
 * Member dashboard — shows own HR, zone, session duration.
 * Updates in < 1 second when new MQTT data arrives.
 * Requirements: 14.1, 14.2, 14.4
 */
export default function MemberDashboardPage() {
  const clubId =
    typeof window !== "undefined"
      ? (sessionStorage.getItem("clubId") ?? "")
      : "";
  const userId =
    typeof window !== "undefined"
      ? (sessionStorage.getItem("userId") ?? "")
      : "";

  const [hr, setHr] = useState<number | null>(null);
  const [zone, setZone] = useState<HRZone>("unknown");
  const [sessionStart] = useState<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Update session duration every second
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStart]);

  const handleMessage = useCallback(
    (topic: string, payload: Buffer) => {
      const parts = topic.split("/");
      if (parts.length < 4) return;
      const type = parts[3];

      try {
        const data = JSON.parse(payload.toString());

        if (type === "hr") {
          setHr(data.hr as number);
          setZone((data.hr_zone ?? "unknown") as HRZone);
        }

        if (type === "alerts") {
          const alert: Alert = {
            id: `${Date.now()}`,
            memberId: userId,
            memberName: "Saya",
            type: data.alert_type as "CRITICAL" | "WARNING",
            message: data.alert_message as string,
            timestamp: Date.now(),
          };
          setAlerts((prev) => [alert, ...prev].slice(0, 5));
        }
      } catch {
        // Ignore malformed messages
      }
    },
    [userId],
  );

  const { status, subscribe } = useMqtt({ onMessage: handleMessage });

  useEffect(() => {
    if (status === "connected" && clubId && userId) {
      subscribe(`fitsense/${clubId}/${userId}/hr`);
      subscribe(`fitsense/${clubId}/${userId}/alerts`);
    }
  }, [status, clubId, userId, subscribe]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div style={{ padding: 24, maxWidth: 500, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1>Dashboard Member</h1>
        <ConnectionStatus status={status} />
      </div>

      <AlertBanner
        alerts={alerts}
        onDismiss={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
      />

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 32,
          textAlign: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#1d4ed8",
            lineHeight: 1,
          }}
        >
          {hr ?? "--"}
        </div>
        <div style={{ fontSize: 18, color: "#6b7280", marginBottom: 16 }}>
          bpm
        </div>
        <HRZoneBadge zone={zone} />
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 16,
          textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
          Durasi Sesi
        </div>
        <div style={{ fontSize: 32, fontWeight: 600 }}>
          {formatDuration(elapsed)}
        </div>
      </div>
    </div>
  );
}
