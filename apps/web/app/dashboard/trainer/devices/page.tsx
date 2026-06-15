"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../../components/Navbar";
import DeviceStatusBadge, {
  DeviceStatus,
} from "../../../../components/devices/DeviceStatusBadge";
import { apiGet, getCompanyId } from "../../../../lib/api";

interface Device {
  id: string;
  name: string | null;
  mac_address: string;
  device_type: string;
  status: DeviceStatus;
  notes: string | null;
}

export default function TrainerDevicesPage() {
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

  const filtered = search
    ? devices.filter((d) =>
        `${d.name ?? ""} ${d.mac_address}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : devices;

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
              {devices.length} device terdaftar
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          {["", "available", "borrowed", "maintenance", "lost"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border:
                  statusFilter === s
                    ? "1px solid #2563eb"
                    : "1px solid #e5e7eb",
                background: statusFilter === s ? "#eff6ff" : "#fff",
                color: statusFilter === s ? "#2563eb" : "#64748b",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {s || "Semua"}
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
              Belum ada device
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
                  {["Nama", "MAC Address", "Tipe", "Status", "Catatan"].map(
                    (h) => (
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
                    ),
                  )}
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
                      }}
                    >
                      {d.notes ?? "—"}
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
