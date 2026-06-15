"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "../../../../../components/Navbar";
import PageHeader from "../../../../../components/PageHeader";
import AssignmentStatusBadge, {
  AssignmentStatus,
} from "../../../../../components/assignments/AssignmentStatusBadge";
import {
  apiGet,
  apiPatch,
  apiDelete,
  getCompanyId,
} from "../../../../../lib/api";

interface Assignment {
  id: string;
  member_name: string;
  workout_name: string;
  trainer_name: string;
  assigned_date: string;
  status: AssignmentStatus;
  notes: string | null;
  session_id: string | null;
  intro_activities: string | null;
  intro_duration: number | null;
}

export default function TrainerAssignmentDetailPage() {
  const router = useRouter();
  const { assignmentId } = useParams() as { assignmentId: string };
  const companyId = getCompanyId();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId || !assignmentId) return;
    apiGet(`/companies/${companyId}/assignments/${assignmentId}`).then(
      ({ ok, data }) => {
        if (ok) setAssignment(data.assignment);
        else setError("Assignment tidak ditemukan");
        setLoading(false);
      },
    );
  }, [companyId, assignmentId]);

  const handleSkip = async () => {
    if (!assignment) return;
    const { ok, data } = await apiPatch(
      `/companies/${companyId}/assignments/${assignment.id}`,
      { status: "skipped" },
    );
    if (ok) setAssignment(data.assignment);
    else setError(data?.error?.message ?? "Gagal update");
  };

  const handleDelete = async () => {
    if (!assignment || !confirm("Hapus assignment ini?")) return;
    const { ok } = await apiDelete(
      `/companies/${companyId}/assignments/${assignment.id}`,
    );
    if (ok) router.push("/dashboard/trainer/assignments");
  };

  if (loading)
    return <div style={{ padding: 40, color: "#64748b" }}>Memuat...</div>;
  if (error || !assignment)
    return (
      <div style={{ padding: 40, color: "#dc2626" }}>
        {error || "Tidak ditemukan"}
      </div>
    );

  const isPending = assignment.status === "pending";

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <div style={{ padding: "28px 24px", maxWidth: 700, margin: "0 auto" }}>
        <PageHeader
          title="Detail Assignment"
          subtitle={`${assignment.workout_name} → ${assignment.member_name}`}
          action={
            <button
              onClick={() => router.back()}
              style={{
                padding: "8px 16px",
                background: "#f1f5f9",
                color: "#374151",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ← Kembali
            </button>
          }
        />

        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>
              {assignment.workout_name}
            </span>
            <AssignmentStatusBadge status={assignment.status} />
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            {[
              ["Member", assignment.member_name],
              ["Trainer", assignment.trainer_name],
              [
                "Tanggal",
                new Date(assignment.assigned_date).toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              ],
              [
                "Durasi",
                assignment.intro_duration
                  ? `${assignment.intro_duration} menit`
                  : "—",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.4px",
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 14, color: "#374151" }}>{value}</div>
              </div>
            ))}
          </div>

          {assignment.intro_activities && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.4px",
                  marginBottom: 4,
                }}
              >
                Deskripsi
              </div>
              <div style={{ fontSize: 14, color: "#374151" }}>
                {assignment.intro_activities}
              </div>
            </div>
          )}

          {assignment.notes && (
            <div
              style={{
                background: "#f8fafc",
                borderRadius: 8,
                padding: "10px 14px",
                borderLeft: "3px solid #3b82f6",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: 4,
                }}
              >
                CATATAN
              </div>
              <div style={{ fontSize: 14, color: "#374151" }}>
                {assignment.notes}
              </div>
            </div>
          )}

          {assignment.status === "completed" && assignment.session_id && (
            <div
              style={{
                background: "#f0fdf4",
                borderRadius: 8,
                padding: "10px 14px",
                borderLeft: "3px solid #22c55e",
                fontSize: 14,
                color: "#15803d",
              }}
            >
              ✓ Assignment selesai — sesi telah dilakukan
            </div>
          )}

          {isPending && (
            <div
              style={{
                display: "flex",
                gap: 10,
                paddingTop: 8,
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <button
                onClick={handleSkip}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  background: "#f1f5f9",
                  color: "#64748b",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Mark as Skipped
              </button>
              <button
                onClick={handleDelete}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  background: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Hapus Assignment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
