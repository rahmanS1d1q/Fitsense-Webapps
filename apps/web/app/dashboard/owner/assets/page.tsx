"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../../components/Navbar";
import { apiGet, getCompanyId, getAuthHeaders } from "../../../../lib/api";

interface Asset {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
  published: boolean;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function AssetsListPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const companyId = getCompanyId();
    if (!companyId) return;
    const path = filter
      ? `/companies/${companyId}/assets?type=${filter}`
      : `/companies/${companyId}/assets`;
    const { ok, data } = await apiGet(path);
    if (ok) setAssets(data.assets ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus asset ini?")) return;
    const companyId = getCompanyId();
    const res = await fetch(`${API_URL}/companies/${companyId}/assets/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.ok) load();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <div style={{ padding: "28px 24px", maxWidth: 1000, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Assets
          </h1>
          <button
            onClick={() => router.push("/dashboard/owner/assets/upload")}
            style={{
              padding: "10px 20px",
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            + Upload File
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            "",
            "profile_photo",
            "workout_image",
            "workout_video",
            "club_banner",
          ].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border:
                  filter === t ? "1px solid #2563eb" : "1px solid #e2e8f0",
                background: filter === t ? "#eff6ff" : "#fff",
                color: filter === t ? "#2563eb" : "#64748b",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {t || "Semua"}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: "#64748b" }}>Memuat...</p>
        ) : assets.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
            <p style={{ fontSize: 16, color: "#64748b", fontWeight: 500 }}>
              Belum ada asset
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {assets.map((a) => (
              <div
                key={a.id}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: 120,
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {a.type.includes("image") ||
                  a.type === "profile_photo" ||
                  a.type === "club_banner" ? (
                    <img
                      src={`${API_URL.replace("/api", "")}${a.url}`}
                      alt={a.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 32 }}>🎬</span>
                  )}
                </div>
                <div style={{ padding: 12 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1e293b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    {a.type} • {a.size}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: a.published ? "#d1fae5" : "#f1f5f9",
                        color: a.published ? "#059669" : "#94a3b8",
                      }}
                    >
                      {a.published ? "Published" : "Draft"}
                    </span>
                    <button
                      onClick={() => handleDelete(a.id)}
                      style={{
                        fontSize: 11,
                        color: "#dc2626",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
