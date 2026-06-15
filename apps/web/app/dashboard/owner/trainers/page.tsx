"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../../components/Navbar";
import { apiGet, getCompanyId } from "../../../../lib/api";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
}

export default function TrainersListPage() {
  const router = useRouter();
  const [trainers, setTrainers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const companyId = getCompanyId();
    if (!companyId) return;
    const { ok, data } = await apiGet(`/companies/${companyId}/members`);
    if (ok) {
      const all = data.members ?? [];
      setTrainers(
        all.filter(
          (m: Member) => m.role === "trainer" || m.role === "club_owner",
        ),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
              Trainers & Staff
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>
              {trainers.length} orang
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/owner/trainers/new")}
            style={{
              padding: "10px 20px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
            }}
          >
            + Tambah Trainer
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#64748b" }}>Memuat...</p>
        ) : trainers.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <p style={{ fontSize: 16, color: "#64748b", fontWeight: 500 }}>
              Belum ada trainer
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {trainers.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
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
                    {(t.first_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      {t.first_name} {t.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      {t.email}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    background: t.role === "club_owner" ? "#dbeafe" : "#d1fae5",
                    color: t.role === "club_owner" ? "#1d4ed8" : "#059669",
                    textTransform: "uppercase",
                  }}
                >
                  {t.role === "club_owner" ? "Owner" : "Trainer"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
