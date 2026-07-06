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
import { apiGet, apiPatch, apiDelete, getCompanyId, getRole } from "../../../../lib/api";
import DeleteConfirmDialog from "../../../../components/common/DeleteConfirmDialog";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  deleted_at?: string | null;
}

export default function MembersListPage() {
  const router = useRouter();
  const companyId = getCompanyId();
  const myRole = getRole();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "inactive">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"soft" | "hard">("soft");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadMembers = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { ok, data } = await apiGet(`/companies/${companyId}/members`);
    if (ok) {
      // Filter out non-members if we only want member role, or show all?
      // The prompt says "Halaman list member", so we filter for role === 'member'
      const all = data.members ?? [];
      const onlyMembers = all.filter((m: Member) => m.role === "member");
      setMembers(onlyMembers);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleSoftDeleteClick = (member: Member) => {
    setSelectedMember(member);
    setDialogMode("soft");
    setDialogOpen(true);
    setErrorMsg("");
  };

  const handleHardDeleteClick = (member: Member) => {
    setSelectedMember(member);
    setDialogMode("hard");
    setDialogOpen(true);
    setErrorMsg("");
  };

  const handleRestore = async (member: Member) => {
    if (!companyId) return;
    if (!confirm(`Aktifkan kembali member "${member.first_name} ${member.last_name}"?`)) return;

    const { ok, data } = await apiPatch(`/companies/${companyId}/members/${member.id}/restore`, {});
    if (ok) {
      loadMembers();
    } else {
      alert(data?.error?.message ?? "Gagal mengaktifkan kembali member");
    }
  };

  const handleDialogConfirm = async (confirmationName?: string) => {
    if (!companyId || !selectedMember) return;
    setIsBusy(true);
    setErrorMsg("");

    try {
      if (dialogMode === "soft") {
        const { ok, data } = await apiDelete(`/companies/${companyId}/members/${selectedMember.id}`);
        if (ok) {
          setDialogOpen(false);
          loadMembers();
        } else {
          setErrorMsg(data?.error?.message ?? "Gagal menonaktifkan member");
        }
      } else {
        // Hard delete
        const { ok, data } = await apiDelete(`/companies/${companyId}/members/${selectedMember.id}/permanent`, {
          confirmation_name: confirmationName,
        });
        if (ok) {
          setDialogOpen(false);
          loadMembers();
        } else {
          setErrorMsg(data?.error?.message ?? "Gagal menghapus permanen member");
        }
      }
    } catch {
      setErrorMsg("Terjadi kesalahan koneksi");
    } finally {
      setIsBusy(false);
    }
  };

  // Filter members by tab and search query
  const filteredMembers = members.filter((m) => {
    const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "active") return m.status === "active";
    if (activeTab === "inactive") return m.status === "inactive";
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <PageContainer maxWidth="5xl">
        <PageHeader
          title="Manajemen Member"
          subtitle="Kelola status aktif/nonaktif dan data member gym"
          right={
            <button
              onClick={() => router.push(`/dashboard/${myRole}/members/new`)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              + Tambah Member
            </button>
          }
        />

        <PageSection>
          {/* Tabs & Search */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              marginBottom: "16px",
              flexWrap: "wrap",
            }}
          >
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                background: "#e2e8f0",
                padding: "4px",
                borderRadius: "8px",
                gap: "4px",
              }}
            >
              {(["all", "active", "inactive"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "6px",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    cursor: "pointer",
                    background: activeTab === tab ? "#ffffff" : "transparent",
                    color: activeTab === tab ? "#1e293b" : "#64748b",
                    boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  {tab === "all" ? "Semua" : tab === "active" ? "Aktif" : "Nonaktif"}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau email..."
              style={{
                padding: "8px 14px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "14px",
                width: "100%",
                maxWidth: "280px",
              }}
            />
          </div>

          <Card>
            {loading ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>Memuat data...</div>
            ) : filteredMembers.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
                <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>👥</span>
                Tidak ada member yang ditemukan
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "13px", fontWeight: 600 }}>
                      <th style={{ padding: "12px 16px" }}>Nama</th>
                      <th style={{ padding: "12px 16px" }}>Email</th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                      <th style={{ padding: "12px 16px" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m) => {
                      const isInactive = m.status === "inactive";
                      const fullName = `${m.first_name} ${m.last_name}`.trim();

                      return (
                        <tr
                          key={m.id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            opacity: isInactive ? 0.6 : 1,
                            transition: "opacity 0.2s",
                          }}
                        >
                          <td style={{ padding: "16px", fontWeight: 500, color: "#1e293b" }}>{fullName}</td>
                          <td style={{ padding: "16px", color: "#475569" }}>{m.email}</td>
                          <td style={{ padding: "16px" }}>
                            {isInactive ? (
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
                                Nonaktif
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
                                Aktif
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "16px" }}>
                            <div style={{ display: "flex", gap: "8px" }}>
                              {!isInactive ? (
                                <button
                                  onClick={() => handleSoftDeleteClick(m)}
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
                                  Nonaktifkan
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleRestore(m)}
                                  style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#fff",
                                    color: "#16a34a",
                                    border: "1px solid #22c55e",
                                    borderRadius: "6px",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                  }}
                                >
                                  Aktifkan Kembali
                                </button>
                              )}

                              {/* Super admin only — Hapus Permanen */}
                              {myRole === "super_admin" && (
                                <button
                                  onClick={() => handleHardDeleteClick(m)}
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
                              )}
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

      {selectedMember && (
        <DeleteConfirmDialog
          isOpen={dialogOpen}
          mode={dialogMode}
          entityType="member"
          entityName={`${selectedMember.first_name} ${selectedMember.last_name}`}
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
