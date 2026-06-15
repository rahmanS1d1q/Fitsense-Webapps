"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "../../../../../components/Navbar";
import DeviceStatusBadge, {
  DeviceStatus,
} from "../../../../../components/devices/DeviceStatusBadge";
import {
  apiGet,
  apiPatch,
  getCompanyId,
  getAuthHeaders,
} from "../../../../../lib/api";

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
interface Session {
  id: string;
  started_at: string;
  ended_at: string | null;
  avg_hr: number | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function DeviceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params.deviceId as string;
  const [device, setDevice] = useState<Device | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusVal, setStatusVal] = useState<
    "available" | "maintenance" | "lost"
  >("available");
  const [notes, setNotes] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const companyId = getCompanyId();
    if (!companyId) return;
    Promise.all([
      apiGet(`/companies/${companyId}/devices/company/${deviceId}`),
      // Query recent sessions for this device via direct fetch
      fetch(
        `${API_URL}/companies/${companyId}/devices/company/${deviceId}/sessions`,
        { headers: getAuthHeaders() },
      )
        .then((r) => (r.ok ? r.json() : { sessions: [] }))
        .catch(() => ({ sessions: [] })),
    ]).then(([devRes, sessRes]) => {
      if (devRes.ok) {
        setDevice(devRes.data.device);
        setStatusVal(
          devRes.data.device.status === "borrowed"
            ? "available"
            : devRes.data.device.status,
        );
      }
      setSessions(sessRes.sessions ?? []);
      setLoading(false);
    });
  }, [deviceId]);

  const handleStatusUpdate = async () => {
    const companyId = getCompanyId();
    setBusy(true);
    setStatusMsg("");
    const { ok, data: res } = await apiPatch(
      `/companies/${companyId}/devices/company/${deviceId}/status`,
      { status: statusVal, notes: notes || undefined },
    );
    setBusy(false);
    if (ok) {
      setDevice(res.device);
      setStatusMsg("Status berhasil diperbarui");
    } else setStatusMsg(res?.error?.message ?? "Gagal update status");
  };

  if (loading)
    return (
      <>
        <Navbar />
        <div style={{ padding: 40, color: "#64748b" }}>Memuat...</div>
      </>
    );
  if (!device)
    return (
      <>
        <Navbar />
        <div style={{ padding: 40, color: "#dc2626" }}>
          Device tidak ditemukan
        </div>
      </>
    );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <div style={{ padding: "28px 24px", maxWidth: 720, margin: "0 auto" }}>
        <button
          onClick={() => router.push("/dashboard/owner/devices")}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          ← Kembali
        </button>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 20,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                {device.name ?? "Device Tanpa Nama"}
              </h1>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "#94a3b8",
                  fontFamily: "monospace",
                }}
              >
                {device.mac_address}
              </p>
            </div>
            <DeviceStatusBadge status={device.status} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 20,
            }}
          >
            {[
              { label: "Tipe", value: "Coospo HW706" },
              {
                label: "Terdaftar",
                value: new Date(device.registered_at).toLocaleDateString(
                  "id-ID",
                ),
              },
              { label: "Catatan", value: device.notes ?? "—" },
            ].map((r) => (
              <div
                key={r.label}
                style={{
                  padding: "10px 14px",
                  background: "#f8fafc",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {r.label}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "#374151",
                    marginTop: 4,
                    fontWeight: 500,
                  }}
                >
                  {r.value}
                </div>
              </div>
            ))}
          </div>

          {/* Status update */}
          {device.status !== "borrowed" && (
            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 10,
                }}
              >
                Update Status Manual
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <select
                  value={statusVal}
                  onChange={(e) =>
                    setStatusVal(
                      e.target.value as "available" | "maintenance" | "lost",
                    )
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                >
                  <option value="available">Tersedia</option>
                  <option value="maintenance">Perawatan</option>
                  <option value="lost">Hilang</option>
                </select>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan (opsional)"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 14,
                    minWidth: 180,
                  }}
                />
                <button
                  onClick={handleStatusUpdate}
                  disabled={busy}
                  style={{
                    padding: "9px 18px",
                    background: busy ? "#94a3b8" : "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: busy ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {busy ? "..." : "Simpan"}
                </button>
              </div>
              {statusMsg && (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 13,
                    color: statusMsg.includes("berhasil")
                      ? "#16a34a"
                      : "#dc2626",
                  }}
                >
                  {statusMsg}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Session history */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600 }}>
            Riwayat Sesi (10 terakhir)
          </h2>
          {sessions.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>
              Belum ada sesi yang menggunakan device ini
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    Mulai
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    Selesai
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "right",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    Avg HR
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px", fontSize: 13 }}>
                      {new Date(s.started_at).toLocaleString("id-ID")}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        color: "#64748b",
                      }}
                    >
                      {s.ended_at ? (
                        new Date(s.ended_at).toLocaleString("id-ID")
                      ) : (
                        <span style={{ color: "#16a34a" }}>Aktif</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      {s.avg_hr ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
