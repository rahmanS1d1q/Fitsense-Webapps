"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../../components/Navbar";
import { apiGet, getCompanyId } from "../../../../lib/api";

interface Workout {
  id: string;
  name: string;
  intro_duration: number | null;
  created_at: string;
}

export default function TrainerWorkoutsListPage() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const companyId = getCompanyId();
    if (!companyId) return;
    const { ok, data } = await apiGet(`/companies/${companyId}/workouts`);
    if (ok) setWorkouts(data.workouts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = search
    ? workouts.filter((w) =>
        w.name.toLowerCase().includes(search.toLowerCase()),
      )
    : workouts;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <div style={{ padding: "28px 24px", maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              Workouts
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>
              {workouts.length} program latihan
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/trainer/workouts/new")}
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
            + Tambah Workout
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari workout..."
          style={{
            width: "100%",
            padding: "11px 14px",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            fontSize: 14,
            marginBottom: 16,
            boxSizing: "border-box",
          }}
        />
        {loading ? (
          <p style={{ color: "#64748b" }}>Memuat...</p>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏋️</div>
            <p style={{ fontSize: 16, color: "#64748b", fontWeight: 500 }}>
              {workouts.length === 0 ? "Belum ada workout" : "Tidak ditemukan"}
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
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Nama
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Durasi
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Dibuat
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "right",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      {w.name}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: 14,
                        color: "#64748b",
                      }}
                    >
                      {w.intro_duration ? `${w.intro_duration} menit` : "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: 13,
                        color: "#94a3b8",
                      }}
                    >
                      {new Date(w.created_at).toLocaleDateString("id-ID")}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/trainer/workouts/${w.id}/edit`,
                          )
                        }
                        style={{
                          padding: "4px 12px",
                          background: "#eff6ff",
                          color: "#2563eb",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Edit
                      </button>
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
