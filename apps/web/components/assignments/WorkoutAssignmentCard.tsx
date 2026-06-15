"use client";
import React from "react";
import AssignmentStatusBadge, {
  AssignmentStatus,
} from "./AssignmentStatusBadge";

export interface WorkoutAssignment {
  id: string;
  workout_name: string;
  assigned_date: string;
  trainer_name?: string;
  status: AssignmentStatus;
  notes?: string | null;
  intro_activities?: string | null;
  intro_duration?: number | null;
}

interface Props {
  assignment: WorkoutAssignment;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function WorkoutAssignmentCard({ assignment }: Props) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
            {assignment.workout_name}
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
            📅 {formatDate(assignment.assigned_date)}
          </div>
        </div>
        <AssignmentStatusBadge status={assignment.status} />
      </div>

      {assignment.trainer_name && (
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Trainer:{" "}
          <span style={{ color: "#374151", fontWeight: 500 }}>
            {assignment.trainer_name}
          </span>
        </div>
      )}

      {assignment.intro_duration && (
        <div style={{ fontSize: 13, color: "#64748b" }}>
          ⏱ {assignment.intro_duration} menit
        </div>
      )}

      {assignment.intro_activities && (
        <div style={{ fontSize: 13, color: "#64748b", fontStyle: "italic" }}>
          {assignment.intro_activities}
        </div>
      )}

      {assignment.notes && (
        <div
          style={{
            fontSize: 13,
            color: "#374151",
            background: "#f8fafc",
            borderRadius: 8,
            padding: "8px 12px",
            borderLeft: "3px solid #3b82f6",
          }}
        >
          {assignment.notes}
        </div>
      )}
    </div>
  );
}
