"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../../components/Navbar";
import DeviceStatusBadge, {
  DeviceStatus,
} from "../../../../components/devices/DeviceStatusBadge";
import { apiGet, getCompanyId, getAuthHeaders } from "../../../../lib/api";

interface Device {
  id: string;
  name: string | null;
  mac_address: string;
  device_type: string;
  status: DeviceStatus;
  assigned_to: string | null;
  notes: string | null;
  registered_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "available", label: "Tersedia" },
  { value: "borrowed", label: "Dipinjam" },
  { value: "maintenance", label: "Perawatan" },
  { value: "lost", label: "Hilang" },
];

export default function CompanyDevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const companyId = getCompanyId();
    if (!companyId) return;
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    const { ok, data } = await apiGet(
      `/companies/${companyId}/devices/company${qs}`,
    );
    if (ok) setDevices(data.devices ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus device "${name || id}"?`)) return;
    const companyId = getCompanyId();
    const res = await fetch(
      `${API_URL}/companies/${companyId}/devices/company/${id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      },
    );
    if (res.ok) load();
    else {
      const body = await res.json().catch(() => ({}));
      alert(body?.error?.message ?? "Gagal menghapus device");
    }
  };

  const filtered = search
    ? devices.filter((d) =>
        `${d.name ?? ""} ${d.mac_address}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : devices;

  const counts: Record<string, number> = {
    available: 0,
    borrowed: 0,
    maintenance: 0,
    lost: 0,
  };
  devices.forEach((d) => {
    if (counts[d.status] !== undefined) counts[d.status]++;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <div style={{ padding: "28px 24px", maxWidth: 1000, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
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
              Device Company
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>
              Sensor dan perangkat milik gym
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/owner/devices/new")}
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
            + Tambah Device
          </button>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[
            {
              label: "Total",
              value: devices.length,
              color: "#64748b",
              bg: "#f1f5f9",
            },
            {
              label: "Tersedia",
              value: counts.available,
              color: "#16a34a",
              bg: "#dcfce7",
            },
            {
              label: "Dipinjam",
              value: counts.borrowed,
              color: "#1d4ed8",
              bg: "#dbeafe",
            },
            {
              label: "Perawatan",
              value: counts.maintenance,
              color: "#a16207",
              bg: "#fef9c3",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: s.color,
                  marginTop: 4,
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border:
                  statusFilter === t.value
                    ? "1px solid #2563eb"
                    : "1px solid #e5e7eb",
                background: statusFilter === t.value ? "#eff6ff" : "#fff",
                color: statusFilter === t.value ? "#2563eb" : "#64748b",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama / MAC..."
            style={{
              marginLeft: "auto",
              padding: "6px 14px",
              border: "1px solid #e5e7eb",
              borderRadius: 20,
              fontSize: 13,
              outline: "none",
              minWidth: 200,
            }}
          />
        </div>

        {loading ? (
          <p style={{ color: "#64748b" }}>Memuat...</p>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.4 }}>
              📡
            </div>
            <p style={{ color: "#64748b", fontWeight: 500 }}>
              {devices.length === 0
                ? "Belum ada device terdaftar"
                : "Tidak ditemukan"}
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "Nama",
                    "MAC Address",
                    "Tipe",
                    "Status",
                    "Catatan",
                    "Aksi",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      {d.name ?? <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: 13,
                        fontFamily: "monospace",
                        color: "#374151",
                      }}
                    >
                      {d.mac_address}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: 13,
                        color: "#64748b",
                      }}
                    >
                      Coospo HW706
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <DeviceStatusBadge status={d.status} />
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: 13,
                        color: "#94a3b8",
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.notes ?? "—"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() =>
                            router.push(`/dashboard/owner/devices/${d.id}`)
                          }
                          style={{
                            padding: "4px 10px",
                            background: "#f1f5f9",
                            color: "#374151",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => handleDelete(d.id, d.name ?? "")}
                          disabled={d.status === "borrowed"}
                          style={{
                            padding: "4px 10px",
                            background:
                              d.status === "borrowed" ? "#f1f5f9" : "#fef2f2",
                            color:
                              d.status === "borrowed" ? "#cbd5e1" : "#dc2626",
                            border: "none",
                            borderRadius: 4,
                            cursor:
                              d.status === "borrowed"
                                ? "not-allowed"
                                : "pointer",
                            fontSize: 12,
                          }}
                        >
                          Hapus
                        </button>
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
