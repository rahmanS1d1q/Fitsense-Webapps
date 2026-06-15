"use client";
import React from "react";

export interface Alert {
  id: string;
  memberId: string;
  memberName: string;
  type: "CRITICAL" | "WARNING";
  message: string;
  timestamp: number;
}

interface AlertBannerProps {
  alerts: Alert[];
  onDismiss: (id: string) => void;
}

export default function AlertBanner({ alerts, onDismiss }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
      {alerts.map((alert) => {
        const isCritical = alert.type === "CRITICAL";
        return (
          <div
            key={alert.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderRadius: 10,
              background: isCritical ? "#fef2f2" : "#fffbeb",
              border: `1px solid ${isCritical ? "#fecaca" : "#fde68a"}`,
              animation: "slideIn 0.3s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>{isCritical ? "🚨" : "⚠️"}</span>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isCritical ? "#b91c1c" : "#92400e",
                  }}
                >
                  {alert.type} — {alert.memberName}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: isCritical ? "#dc2626" : "#a16207",
                    marginTop: 2,
                  }}
                >
                  {alert.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => onDismiss(alert.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "#9ca3af",
                padding: "0 4px",
              }}
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
