"use client";
import React from "react";
import HRZoneBadge, { HRZone } from "./HRZoneBadge";

export interface MemberItem {
  id: string;
  name: string;
  hrData?: {
    hr: number;
    zone: HRZone;
    timestamp: number;
  };
}

interface MemberListProps {
  members: MemberItem[];
}

function getHRColor(hr: number): string {
  if (hr < 100) return "#2563eb";
  if (hr < 140) return "#059669";
  if (hr < 170) return "#d97706";
  return "#dc2626";
}

export default function MemberList({ members }: MemberListProps) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {members.map((member) => (
        <div
          key={member.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            transition: "box-shadow 0.2s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 600,
                color: "#64748b",
              }}
            >
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                {member.name}
              </div>
              {member.hrData && (
                <div style={{ marginTop: 2 }}>
                  <HRZoneBadge zone={member.hrData.zone} />
                </div>
              )}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            {member.hrData ? (
              <>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: getHRColor(member.hrData.hr),
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {member.hrData.hr}
                </div>
                <div
                  style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}
                >
                  BPM
                </div>
              </>
            ) : (
              <span style={{ fontSize: 13, color: "#cbd5e1" }}>—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export { MemberList };
