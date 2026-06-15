"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../../components/Navbar";
import PageHeader from "../../../../components/PageHeader";
import AssignmentStatusBadge, {
  AssignmentStatus,
} from "../../../../components/assignments/AssignmentStatusBadge";
import { apiGet, apiPatch, apiDelete, getCompanyId } from "../../../../lib/api";

interface Assignment {
  id: string;
  member_name: string;
  workout_name: string;
  trainer_name: string;
  assigned_date: string;
  status: AssignmentStatus;
  notes: string | null;
  session_id: string | null;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
}

export default function TrainerAssignmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterMember, setFilterMember] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const companyId = getCompanyId();

  const load = useCallback(async () => {
    if (!companyId) return;
    const params = new URLSearchParams();
    if (filterMember) params.set("member_id", filterMember);
    if (filterStatus) params.set("status", filterStatus);
    if (filterDate) params.set("date", filterDate);

    const [aRes, mRes] = await Promise.all([
      apiGet(`/companies/${companyId}/assignments?${params}`),
      apiGet(`/companies/${companyId}/members`),
    ]);
    if (aRes.ok) setAssignments(aRes.data.assignments ?? []);
    if (mRes.ok)
      setMembers(
        (mRes.data.members ?? []).filter(
          (m: { role: string }) => m.role === "member",
        ),
      );
    setLoading(false);
  }, [companyId, filterMember, filterStatus, filterDate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSkip = async (id: string) => {
    const { ok } = await apiPatch(`/companies/${companyId}/assignments/${id}`, {
      status: "skipped",
    });
    if (ok) load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus assignment ini?")) return;
    const { ok } = await apiDelete(`/companies/${companyId}/assignments/${id}`);
    if (ok) load();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <div style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <PageHeader
          title="Workout Assignment"
          subtitle="Assign workout ke member sebelum sesi latihan"
          action={
            <button
              onClick={() => router.push("/dashboard/trainer/assignments/new")}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              + Assign Workout
            </button>
          }
        />

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <select
            value={filterMember}
            onChange={(e) => setFilterMember(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 14,
              background: "#fff",
              minWidth: 160,
            }}
          >
            <option value="">Semua Member</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 14,
              background: "#fff",
            }}
          >
            <option value="">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Selesai</option>
            <option value="skipped">Dilewati</option>
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 14,
              background: "#fff",
            }}
          />
          {(filterMember || filterStatus || filterDate) && (
            <button
              onClick={() => {
                setFilterMember("");
                setFilterStatus("");
                setFilterDate("");
              }}
              style={{
                padding: "8px 12px",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              Reset
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ color: "#64748b" }}>Memuat...</p>
        ) : assignments.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 16, color: "#64748b", fontWeight: 500 }}>
              Belum ada assignment
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "Member",
                    "Workout",
                    "Tanggal",
                    "Trainer",
                    "Status",
                    "Catatan",
                    "Aksi",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td
                      style={{
                        padding: "11px 14px",
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      {a.member_name}
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 14 }}>
                      {a.workout_name}
                    </td>
                    <td
                      style={{
                        padding: "11px 14px",
                        fontSize: 13,
                        color: "#64748b",
                      }}
                    >
                      {new Date(a.assigned_date).toLocaleDateString("id-ID")}
                    </td>
                    <td
                      style={{
                        padding: "11px 14px",
                        fontSize: 13,
                        color: "#64748b",
                      }}
                    >
                      {a.trainer_name}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <AssignmentStatusBadge status={a.status} />
                    </td>
                    <td
                      style={{
                        padding: "11px 14px",
                        fontSize: 13,
                        color: "#94a3b8",
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.notes ?? "—"}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() =>
                            router.push(
                              `/dashboard/trainer/assignments/${a.id}`,
                            )
                          }
                          style={{
                            padding: "4px 10px",
                            background: "#eff6ff",
                            color: "#2563eb",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Detail
                        </button>
                        {a.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleSkip(a.id)}
                              style={{
                                padding: "4px 10px",
                                background: "#f1f5f9",
                                color: "#64748b",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: 12,
                              }}
                            >
                              Skip
                            </button>
                            <button
                              onClick={() => handleDelete(a.id)}
                              style={{
                                padding: "4px 10px",
                                background: "#fef2f2",
                                color: "#dc2626",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: 12,
                              }}
                            >
                              Hapus
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
