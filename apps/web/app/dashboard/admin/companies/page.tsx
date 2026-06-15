"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../../components/Navbar";
import { apiGet } from "../../../../lib/api";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

export default function CompaniesListPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { ok, data } = await apiGet("/admin/companies");
    if (ok) setCompanies(data.companies ?? []);
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
              Companies
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>
              {companies.length} company terdaftar
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/admin/companies/new")}
            style={{
              padding: "10px 20px",
              background: "linear-gradient(135deg, #059669, #047857)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
            }}
          >
            + Buat Company
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#64748b" }}>Memuat...</p>
        ) : companies.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
            <p style={{ fontSize: 16, color: "#64748b", fontWeight: 500 }}>
              Belum ada company
            </p>
            <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
              Klik tombol di atas untuk membuat company pertama
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {companies.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <div
                    style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#64748b",
                      fontFamily: "monospace",
                      marginTop: 2,
                    }}
                  >
                    {c.slug}
                  </div>
                </div>
                <span
                  style={{
                    padding: "3px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    background: c.status === "active" ? "#d1fae5" : "#fee2e2",
                    color: c.status === "active" ? "#059669" : "#dc2626",
                  }}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
