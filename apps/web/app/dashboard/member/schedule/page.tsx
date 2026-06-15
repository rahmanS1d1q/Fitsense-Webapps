"use client";

import React, { useEffect, useState, useCallback } from "react";
import Navbar from "../../../../components/Navbar";
import PageHeader from "../../../../components/PageHeader";
import WorkoutAssignmentCard from "../../../../components/assignments/WorkoutAssignmentCard";
import AssignmentCalendar from "../../../../components/assignments/AssignmentCalendar";
import type { CalendarAssignment } from "../../../../components/assignments/AssignmentCalendar";
import type { AssignmentStatus } from "../../../../components/assignments/AssignmentStatusBadge";
import { apiGet, getCompanyId, getUserId } from "../../../../lib/api";

interface Assignment {
  id: string;
  workout_name: string;
  assigned_date: string;
  trainer_name: string;
  status: AssignmentStatus;
  notes: string | null;
  intro_activities: string | null;
  intro_duration: number | null;
}

export default function MemberSchedulePage() {
  const companyId = getCompanyId();
  const userId = getUserId();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");

  const load = useCallback(async () => {
    if (!companyId || !userId) return;
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    const { ok, data } = await apiGet(
      `/companies/${companyId}/members/${userId}/assignments?${params}`,
    );
    if (ok) setAssignments(data.assignments ?? []);
    setLoading(false);
  }, [companyId, userId, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const calendarItems: CalendarAssignment[] = assignments.map((a) => ({
    id: a.id,
    assigned_date: a.assigned_date,
    status: a.status,
    workout_name: a.workout_name,
  }));

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <div style={{ padding: "28px 24px", maxWidth: 900, margin: "0 auto" }}>
        <PageHeader
          title="Jadwal Latihan"
          subtitle="Workout yang di-assign trainer untuk kamu"
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setView("list")}
                style={{
                  padding: "8px 14px",
                  background: view === "list" ? "#2563eb" : "#f1f5f9",
                  color: view === "list" ? "#fff" : "#374151",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                List
              </button>
              <button
                onClick={() => setView("calendar")}
                style={{
                  padding: "8px 14px",
                  background: view === "calendar" ? "#2563eb" : "#f1f5f9",
                  color: view === "calendar" ? "#fff" : "#374151",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Kalender
              </button>
            </div>
          }
        />

        {/* Filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {[
            { value: "", label: "Semua" },
            { value: "pending", label: "Upcoming" },
            { value: "completed", label: "Selesai" },
            { value: "skipped", label: "Dilewati" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                border:
                  filterStatus === opt.value
                    ? "2px solid #2563eb"
                    : "1px solid #e2e8f0",
                background: filterStatus === opt.value ? "#eff6ff" : "#fff",
                color: filterStatus === opt.value ? "#2563eb" : "#64748b",
                fontSize: 13,
                fontWeight: filterStatus === opt.value ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: "#64748b" }}>Memuat...</p>
        ) : view === "calendar" ? (
          <AssignmentCalendar assignments={calendarItems} />
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
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏃</div>
            <p style={{ fontSize: 16, color: "#64748b", fontWeight: 500 }}>
              {filterStatus
                ? "Tidak ada assignment dengan filter ini"
                : "Belum ada jadwal latihan"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {assignments.map((a) => (
              <WorkoutAssignmentCard
                key={a.id}
                assignment={{
                  id: a.id,
                  workout_name: a.workout_name,
                  assigned_date: a.assigned_date,
                  trainer_name: a.trainer_name,
                  status: a.status,
                  notes: a.notes,
                  intro_activities: a.intro_activities,
                  intro_duration: a.intro_duration,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
