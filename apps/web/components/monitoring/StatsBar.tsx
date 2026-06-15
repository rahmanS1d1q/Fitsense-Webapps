"use client";
import React from "react";

interface Props {
  totalMembers: number;
  activeSessions: number;
  criticalAlerts: number;
}

interface StatDef {
  label: string;
  value: number;
  color: string;
  bg: string;
}

function StatCard({ label, value, color, bg }: StatDef) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 160,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
          }}
        >
          {label}
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: "#111827",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.5px",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 8,
          height: 3,
          borderRadius: 2,
          background: bg,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            background: color,
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  );
}

export default function StatsBar({
  totalMembers,
  activeSessions,
  criticalAlerts,
}: Props) {
  return (
    <div
      style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}
    >
      <StatCard
        label="Total Members"
        value={totalMembers}
        color="#2563eb"
        bg="#dbeafe"
      />
      <StatCard
        label="Active Sessions"
        value={activeSessions}
        color="#16a34a"
        bg="#dcfce7"
      />
      <StatCard
        label="Critical Alerts (1j)"
        value={criticalAlerts}
        color="#dc2626"
        bg="#fee2e2"
      />
    </div>
  );
}
