"use client";
import React from "react";
import HRSparkline, { ZONE_COLORS } from "./HRSparkline";
import type { HRPoint, LiveHR, AlertType } from "../../hooks/useMonitoringMqtt";

export interface MonitoringMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  gender: string | null;
  age: number | null;
  bio_code: string | null;
}

export interface MonitoringSession {
  id: string;
  started_at: string;
  workout_id: string | null;
  mood: string | null;
}

interface Props {
  member: MonitoringMember;
  session: MonitoringSession | null;
  liveHR: LiveHR | null;
  buffer: HRPoint[];
  hasAlert: boolean;
  alertType: AlertType | null;
  onDetail: (memberId: string) => void;
  assignmentName?: string | null;
}

const ZONE_LABEL: Record<string, string> = {
  rest: "Rest",
  fat_burn: "Fat Burn",
  cardio: "Cardio",
  aerobic: "Aerobic",
  peak: "Peak",
  unknown: "—",
};

function formatStart(iso: string): string {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return "baru saja";
  if (diff < 60) return `${diff} menit lalu`;
  const h = Math.floor(diff / 60);
  return `${h} jam lalu`;
}

function MemberCard({
  member,
  session,
  liveHR,
  buffer,
  hasAlert,
  alertType,
  onDetail,
  assignmentName,
}: Props) {
  const name =
    `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() ||
    member.email;
  const initials = (
    member.first_name?.[0] ??
    member.email[0] ??
    "?"
  ).toUpperCase();
  const zone = liveHR?.hr_zone ?? "unknown";
  const zoneColor = ZONE_COLORS[zone] ?? ZONE_COLORS.unknown;

  const border =
    alertType === "CRITICAL"
      ? "1.5px solid #dc2626"
      : alertType === "WARNING"
        ? "1.5px solid #f59e0b"
        : "1px solid #e5e7eb";

  return (
    <div
      style={{
        background: "#fff",
        border,
        borderRadius: 14,
        padding: 16,
        opacity: session ? 1 : 0.55,
        animation: alertType === "CRITICAL" ? "pulse 1.5s infinite" : "none",
        transition: "border-color 0.2s, opacity 0.2s",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 700,
              color: "#475569",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#111827",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#94a3b8",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {member.email}
            </div>
            {assignmentName && (
              <div
                style={{
                  fontSize: 11,
                  color: "#d97706",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: 2,
                }}
              >
                📋 {assignmentName}
              </div>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 12,
            whiteSpace: "nowrap",
            background: session ? "#dcfce7" : "#f1f5f9",
            color: session ? "#15803d" : "#94a3b8",
          }}
        >
          {session ? "Active" : "No Session"}
        </span>
      </div>

      {/* HR + Zone */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.4px",
              marginBottom: 2,
            }}
          >
            Last HR
          </div>
          {liveHR ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: zoneColor,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                  transition: "color 0.3s",
                }}
              >
                {liveHR.hr}
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
                bpm
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#cbd5e1", paddingTop: 6 }}>
              Waiting for HR data...
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 12,
            background: `${zoneColor}1a`,
            color: zoneColor,
          }}
        >
          {ZONE_LABEL[zone] ?? "—"}
        </span>
      </div>

      {/* Sparkline */}
      <HRSparkline data={buffer} zone={zone} />

      {/* Meta */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#64748b",
          borderTop: "1px solid #f1f5f9",
          paddingTop: 10,
        }}
      >
        <span>
          {member.gender ? (member.gender === "male" ? "L" : "P") : "—"} ·{" "}
          {member.age ?? "—"} thn
        </span>
        <span>{session ? formatStart(session.started_at) : "—"}</span>
      </div>

      {/* Detail button */}
      <button
        onClick={() => onDetail(member.id)}
        style={{
          padding: "8px 12px",
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 500,
          color: "#374151",
        }}
      >
        Detail
      </button>
    </div>
  );
}

export default React.memo(MemberCard);
