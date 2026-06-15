"use client";
import React from "react";

export type AssignmentStatus = "pending" | "completed" | "skipped";

interface Props {
  status: AssignmentStatus;
}

const config: Record<
  AssignmentStatus,
  { label: string; bg: string; color: string }
> = {
  pending: { label: "Pending", bg: "#fef9c3", color: "#854d0e" },
  completed: { label: "Selesai", bg: "#dcfce7", color: "#15803d" },
  skipped: { label: "Dilewati", bg: "#f1f5f9", color: "#64748b" },
};

export default function AssignmentStatusBadge({ status }: Props) {
  const c = config[status] ?? config.pending;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: c.bg,
        color: c.color,
        whiteSpace: "nowrap",
      }}
    >
      {c.label}
    </span>
  );
}
