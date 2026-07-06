"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../../components/Navbar";
import PageHeader from "../../../../components/PageHeader";
import {
  PageContainer,
  PageSection,
  Card,
} from "../../../../components/layout/PageContainer";
import { apiGet, apiDelete, apiPatch } from "../../../../lib/api";
import DeleteConfirmDialog from "../../../../components/common/DeleteConfirmDialog";

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

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"soft" | "hard">("soft");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiGet("/admin/companies");
    if (ok) setCompanies(data.companies ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSuspendClick = (company: Company) => {
    setSelectedCompany(company);
    setDialogMode("soft");
    setDialogOpen(true);
    setErrorMsg("");
  };

  const handlePermanentDeleteClick = (company: Company) => {
    setSelectedCompany(company);
    setDialogMode("hard");
    setDialogOpen(true);
    setErrorMsg("");
  };

  const handleDialogConfirm = async (confirmationName?: string) => {
    if (!selectedCompany) return;
    setIsBusy(true);
    setErrorMsg("");

    try {
      if (dialogMode === "soft") {
        // Suspend company
        const { ok, data } = await apiDelete(`/companies/${selectedCompany.id}`);
        if (ok) {
          setDialogOpen(false);
          load();
        } else {
          setErrorMsg(data?.error?.message ?? "Gagal menonaktifkan company");
        }
      } else {
        // Permanent delete
        const { ok, data } = await apiDelete(`/companies/${selectedCompany.id}/permanent`, {
          confirmation_name: confirmationName,
        });
        if (ok) {
          setDialogOpen(false);
          load();
        } else {
          setErrorMsg(data?.error?.message ?? "Gagal menghapus permanen company");
        }
      }
    } catch {
      setErrorMsg("Terjadi kesalahan koneksi");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <PageContainer maxWidth="5xl">
        <PageHeader
          title="Manajemen Company"
          subtitle="Kelola dan pantau seluruh tenant/company di platform FitSense"
          right={
            <button
              onClick={() => router.push("/dashboard/admin/companies/new")}
              style={{
                padding: "8px 16px",
                backgroundColor: "#059669",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              + Buat Company
            </button>
          }
        />

        <PageSection>
          <Card>
            {loading ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>Memuat data...</div>
            ) : companies.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
                <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>🏢</span>
                Belum ada company terdaftar
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "13px", fontWeight: 600 }}>
                      <th style={{ padding: "12px 16px" }}>Nama Company</th>
                      <th style={{ padding: "12px 16px" }}>Slug</th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                      <th style={{ padding: "12px 16px" }}>Tanggal Terdaftar</th>
                      <th style={{ padding: "12px 16px" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => {
                      const isSuspended = c.status === "suspended";

                      return (
                        <tr
                          key={c.id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            opacity: isSuspended ? 0.6 : 1,
                            transition: "opacity 0.2s",
                          }}
                        >
                          <td style={{ padding: "16px", fontWeight: 500, color: "#1e293b" }}>{c.name}</td>
                          <td style={{ padding: "16px", color: "#475569", fontFamily: "monospace" }}>{c.slug}</td>
                          <td style={{ padding: "16px" }}>
                            {isSuspended ? (
                              <span
                                style={{
                                  padding: "3px 8px",
                                  backgroundColor: "#fee2e2",
                                  color: "#ef4444",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                              >
                                Suspended
                              </span>
                            ) : (
                              <span
                                style={{
                                  padding: "3px 8px",
                                  backgroundColor: "#dcfce7",
                                  color: "#22c55e",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                              >
                                Active
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "16px", color: "#64748b" }}>
                            {c.created_at ? new Date(c.created_at).toLocaleDateString("id-ID") : "-"}
                          </td>
                          <td style={{ padding: "16px" }}>
                            <div style={{ display: "flex", gap: "8px" }}>
                              {!isSuspended && (
                                <button
                                  onClick={() => handleSuspendClick(c)}
                                  style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#fff",
                                    color: "#d97706",
                                    border: "1px solid #f59e0b",
                                    borderRadius: "6px",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                  }}
                                >
                                  Suspend
                                </button>
                              )}
                              <button
                                onClick={() => handlePermanentDeleteClick(c)}
                                style={{
                                  padding: "6px 12px",
                                  backgroundColor: "#fee2e2",
                                  color: "#dc2626",
                                  border: "none",
                                  borderRadius: "6px",
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Hapus Permanen
                              </button>
                            </div>
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

      {selectedCompany && (
        <DeleteConfirmDialog
          isOpen={dialogOpen}
          mode={dialogMode}
          entityType="company"
          entityName={selectedCompany.name}
          onConfirm={handleDialogConfirm}
          onCancel={() => setDialogOpen(false)}
          isBusy={isBusy}
        />
      )}

      {errorMsg && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: "12px 20px",
            backgroundColor: "#ef4444",
            color: "#ffffff",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            zIndex: 99999,
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
