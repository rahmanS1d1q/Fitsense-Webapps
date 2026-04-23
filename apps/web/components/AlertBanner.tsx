"use client";

import React, { useEffect, useState } from "react";

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
  onDismiss?: (id: string) => void;
}

/**
 * Displays prominent alert notifications.
 * Red for CRITICAL, yellow for WARNING.
 * Requirements: 13.4
 */
export default function AlertBanner({ alerts, onDismiss }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginBottom: 16,
      }}
    >
      {alerts.map((alert) => (
        <div
          key={alert.id}
          role="alert"
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            backgroundColor: alert.type === "CRITICAL" ? "#fee2e2" : "#fef9c3",
            borderLeft: `4px solid ${alert.type === "CRITICAL" ? "#dc2626" : "#ca8a04"}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              color: alert.type === "CRITICAL" ? "#b91c1c" : "#a16207",
              minWidth: 80,
            }}
          >
            {alert.type}
          </span>
          <span style={{ flex: 1 }}>
            <strong>{alert.memberName}</strong>: {alert.message}
          </span>
          {onDismiss && (
            <button
              onClick={() => onDismiss(alert.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "#6b7280",
              }}
              aria-label="Tutup notifikasi"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
