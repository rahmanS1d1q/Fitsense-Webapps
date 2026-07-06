"use client";

import React, { useEffect, useState, useCallback } from "react";
import Navbar from "../../../../components/Navbar";
import PageHeader from "../../../../components/PageHeader";
import {
  PageContainer,
  PageSection,
  Card,
} from "../../../../components/layout/PageContainer";
import { apiGet } from "../../../../lib/api";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_data: Record<string, unknown> | null;
  performed_by: string;
  performed_at: string;
  notes: string | null;
  performer_first_name?: string;
  performer_last_name?: string;
  performer_email?: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (actionFilter) params.append("action", actionFilter);
    if (entityTypeFilter) params.append("entityType", entityTypeFilter);
    if (fromDate) params.append("from", new Date(fromDate).toISOString());
    if (toDate) params.append("to", new Date(toDate).toISOString());

    const { ok, data } = await apiGet(`/admin/audit-logs?${params.toString()}`);
    if (ok) {
      setLogs(data.logs ?? []);
    }
    setLoading(false);
  }, [actionFilter, entityTypeFilter, fromDate, toDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getBadgeStyle = (action: string) => {
    const base = {
      padding: "4px 8px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: 600,
      textTransform: "uppercase" as const,
      display: "inline-block",
    };

    switch (action) {
      case "soft_delete":
        return { ...base, backgroundColor: "#fef3c7", color: "#d97706" }; // Kuning
      case "hard_delete":
        return { ...base, backgroundColor: "#fee2e2", color: "#dc2626" }; // Merah
      case "restore":
        return { ...base, backgroundColor: "#dcfce7", color: "#16a34a" }; // Hijau
      case "suspend_company":
        return { ...base, backgroundColor: "#ffedd5", color: "#ea580c" }; // Oranye
      case "activate_company":
        return { ...base, backgroundColor: "#dbeafe", color: "#2563eb" }; // Biru
      default:
        return { ...base, backgroundColor: "#f1f5f9", color: "#475569" };
    }
  };

  const formatActionName = (action: string) => {
    return action.replace("_", " ");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <PageContainer maxWidth="6xl">
        <PageHeader
          title="Audit Logs"
          subtitle="Catatan riwayat aktivitas hapus, pulihkan, dan penangguhan sistem"
        />

        <PageSection>
          {/* Filter Bar */}
          <Card className="mb-4">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  Aksi
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: "#fff",
                  }}
                >
                  <option value="">Semua Aksi</option>
                  <option value="soft_delete">Soft Delete</option>
                  <option value="hard_delete">Hard Delete</option>
                  <option value="restore">Restore</option>
                  <option value="suspend_company">Suspend Company</option>
                  <option value="activate_company">Activate Company</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  Tipe Entitas
                </label>
                <select
                  value={entityTypeFilter}
                  onChange={(e) => setEntityTypeFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: "#fff",
                  }}
                >
                  <option value="">Semua Tipe</option>
                  <option value="user">User / Member</option>
                  <option value="company">Company</option>
                  <option value="session">Session</option>
                  <option value="device">Device</option>
                  <option value="workout">Workout</option>
                  <option value="workout_assignment">Workout Assignment</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>
          </Card>

          <Card>
            {loading ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>Memuat data...</div>
            ) : logs.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
                <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>📜</span>
                Tidak ada log audit yang cocok dengan filter
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "13px", fontWeight: 600 }}>
                      <th style={{ padding: "12px 16px" }}>Tanggal</th>
                      <th style={{ padding: "12px 16px" }}>Pelaku</th>
                      <th style={{ padding: "12px 16px" }}>Aksi</th>
                      <th style={{ padding: "12px 16px" }}>Tipe Entitas</th>
                      <th style={{ padding: "12px 16px" }}>ID Entitas</th>
                      <th style={{ padding: "12px 16px" }}>Data Snapshot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const performerName = log.performer_first_name
                        ? `${log.performer_first_name} ${log.performer_last_name ?? ""}`.trim()
                        : "Sistem";

                      return (
                        <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "16px", color: "#1e293b", whiteSpace: "nowrap" }}>
                            {new Date(log.performed_at).toLocaleString("id-ID")}
                          </td>
                          <td style={{ padding: "16px" }}>
                            <div style={{ fontWeight: 500, color: "#1e293b" }}>{performerName}</div>
                            {log.performer_email && (
                              <div style={{ fontSize: "12px", color: "#64748b" }}>{log.performer_email}</div>
                            )}
                          </td>
                          <td style={{ padding: "16px" }}>
                            <span style={getBadgeStyle(log.action)}>{formatActionName(log.action)}</span>
                          </td>
                          <td style={{ padding: "16px", color: "#475569", textTransform: "capitalize" }}>
                            {log.entity_type.replace("_", " ")}
                          </td>
                          <td style={{ padding: "16px", color: "#64748b", fontFamily: "monospace", fontSize: "12px" }}>
                            {log.entity_id}
                          </td>
                          <td style={{ padding: "16px" }}>
                            {log.entity_data ? (
                              <details style={{ cursor: "pointer" }}>
                                <summary style={{ fontSize: "13px", color: "#2563eb", fontWeight: 500 }}>Lihat Data</summary>
                                <pre
                                  style={{
                                    marginTop: "8px",
                                    padding: "8px",
                                    backgroundColor: "#f8fafc",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontFamily: "monospace",
                                    overflowX: "auto",
                                    whiteSpace: "pre-wrap",
                                    maxWidth: "300px",
                                  }}
                                >
                                  {JSON.stringify(log.entity_data, null, 2)}
                                </pre>
                              </details>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: "13px" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </PageSection>
      </PageContainer>
    </div>
  );
}
