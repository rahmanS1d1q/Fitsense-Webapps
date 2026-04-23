"use client";

import React, { useEffect, useState } from "react";

interface Club {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
}

interface StorageStats {
  clubs: Array<{
    clubId: string;
    clubName: string;
    storageMb: number;
    dataPoints: number;
    estimatedDaysRemaining: number;
  }>;
  totalStorageMb: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Admin dashboard — lists all clubs and storage stats.
 * Requirements: 1.4, 20.5
 */
export default function AdminDashboardPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const jwt =
      typeof window !== "undefined" ? sessionStorage.getItem("jwt") : null;
    const headers: HeadersInit = jwt ? { Authorization: `Bearer ${jwt}` } : {};

    Promise.all([
      fetch(`${API_URL}/clubs`, { headers }).then((r) => r.json()),
      fetch(`${API_URL}/admin/storage/stats`, { headers }).then((r) =>
        r.json(),
      ),
    ])
      .then(([clubsData, statsData]) => {
        setClubs(
          Array.isArray(clubsData) ? clubsData : (clubsData.clubs ?? []),
        );
        setStorageStats(statsData);
      })
      .catch(() => setError("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Memuat...</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>{error}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 24 }}>Admin Dashboard</h1>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 12 }}>Semua Club</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Nama</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Slug</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((club) => (
              <tr key={club.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "8px 12px" }}>{club.name}</td>
                <td style={{ padding: "8px 12px", color: "#6b7280" }}>
                  {club.slug}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor:
                        club.status === "active" ? "#dcfce7" : "#fee2e2",
                      color: club.status === "active" ? "#15803d" : "#b91c1c",
                    }}
                  >
                    {club.status}
                  </span>
                </td>
              </tr>
            ))}
            {clubs.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  style={{ padding: 16, textAlign: "center", color: "#9ca3af" }}
                >
                  Belum ada club terdaftar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {storageStats && (
        <section>
          <h2 style={{ marginBottom: 12 }}>Storage Stats</h2>
          <p style={{ marginBottom: 12, color: "#6b7280" }}>
            Total: {storageStats.totalStorageMb.toFixed(2)} MB
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Club</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>
                  Storage (MB)
                </th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>
                  Data Points
                </th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>
                  Est. Hari Tersisa
                </th>
              </tr>
            </thead>
            <tbody>
              {storageStats.clubs.map((row) => (
                <tr
                  key={row.clubId}
                  style={{ borderBottom: "1px solid #e5e7eb" }}
                >
                  <td style={{ padding: "8px 12px" }}>{row.clubName}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    {row.storageMb.toFixed(2)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    {row.dataPoints.toLocaleString()}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    {row.estimatedDaysRemaining}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
