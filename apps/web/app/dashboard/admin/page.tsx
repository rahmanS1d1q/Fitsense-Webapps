"use client";

import React, { useEffect, useState, useCallback } from "react";
import Navbar from "../../../components/Navbar";
import PageHeader from "../../../components/PageHeader";
import {
  PageContainer,
  PageSection,
  Card,
} from "../../../components/layout/PageContainer";
import { apiGet, apiPatch, apiPost, apiDelete } from "../../../lib/api";
import AdminStatsBar from "../../../components/admin/AdminStatsBar";
import UserTable from "../../../components/admin/UserTable";
import CompanyTable from "../../../components/admin/CompanyTable";
import Pagination from "../../../components/common/Pagination";
import DeleteConfirmDialog from "../../../components/common/DeleteConfirmDialog";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  member_count: number | string;
  trainer_count: number | string;
  created_at: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  main_role: string;
  roles: string[];
  companies: string[];
  status: string;
}

interface Stats {
  total_users: number;
  active_users: number;
  total_companies: number;
  inactive_users: number;
}

interface UserForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  companyId: string;
}

interface CompanyForm {
  name: string;
  slug: string;
  address: string;
  phone: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  ownerPassword: string;
}

const EMPTY_USER: UserForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "member",
  companyId: "",
};

const EMPTY_COMPANY: CompanyForm = {
  name: "",
  slug: "",
  address: "",
  phone: "",
  ownerFirstName: "",
  ownerLastName: "",
  ownerEmail: "",
  ownerPassword: "",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 5,
  fontWeight: 500,
  fontSize: 13,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  boxSizing: "border-box",
};

function AlertBox({ type, msg }: { type: "error" | "success"; msg: string }) {
  if (!msg) return null;
  const isErr = type === "error";
  return (
    <div
      style={{
        padding: "10px 14px",
        background: isErr ? "#fef2f2" : "#f0fdf4",
        border: `1px solid ${isErr ? "#fecaca" : "#bbf7d0"}`,
        borderRadius: 6,
        color: isErr ? "#dc2626" : "#15803d",
        marginBottom: 14,
        fontSize: 14,
      }}
    >
      {isErr ? "✕ " : "✓ "}{msg}
    </div>
  );
}

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Types and constants remain the same...

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#64748b", textAlign: "center" }}>Memuat...</div>}>
      <AdminDashboardContent />
    </Suspense>
  );
}

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<"users" | "companies">("users");

  // Sync tab with search param
  useEffect(() => {
    if (tabParam === "users" || tabParam === "companies") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Stats State
  const [stats, setStats] = useState<Stats>({
    total_users: 0,
    active_users: 0,
    total_companies: 0,
    inactive_users: 0,
  });

  // Users Tab State
  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit, setUsersLimit] = useState(10);
  const [usersPages, setUsersPages] = useState(0);
  const [usersLoading, setUsersLoading] = useState(true);

  // Users Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");

  // Companies Tab State
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);

  // Forms Visibility & State
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState<UserForm>(EMPTY_USER);
  const [userErr, setUserErr] = useState("");
  const [userOk, setUserOk] = useState("");
  const [userBusy, setUserBusy] = useState(false);

  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(EMPTY_COMPANY);
  const [companyErr, setCompanyErr] = useState("");
  const [companyOk, setCompanyOk] = useState("");
  const [companyBusy, setCompanyBusy] = useState(false);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"soft" | "hard">("soft");
  const [dialogType, setDialogType] = useState<"user" | "company">("user");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  // Debounce Search Query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setUsersPage(1); // Reset page on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load Stats
  const loadStats = useCallback(async () => {
    const { ok, data } = await apiGet("/admin/stats");
    if (ok && data) {
      setStats(data);
    }
  }, []);

  // Load Users
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const params = new URLSearchParams({
      page: String(usersPage),
      limit: String(usersLimit),
    });
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (roleFilter) params.append("role", roleFilter);
    if (statusFilter) params.append("status", statusFilter);
    if (companyFilter) params.append("company_id", companyFilter);

    const { ok, data } = await apiGet(`/admin/users?${params.toString()}`);
    if (ok && data) {
      setUsers(data.users ?? []);
      setUsersTotal(data.total ?? 0);
      setUsersPages(data.pages ?? 0);
    }
    setUsersLoading(false);
  }, [usersPage, usersLimit, debouncedSearch, roleFilter, statusFilter, companyFilter]);

  // Load Companies
  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    const { ok, data } = await apiGet("/admin/companies");
    if (ok && data) {
      setCompanies(data.companies ?? []);
    }
    setCompaniesLoading(false);
  }, []);

  // Initial Load & Tab switching
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === "users") {
      loadUsers();
    } else {
      loadCompanies();
    }
  }, [activeTab, loadUsers, loadCompanies]);

  // Refresh all data
  const refreshAll = () => {
    loadStats();
    if (activeTab === "users") {
      loadUsers();
    } else {
      loadCompanies();
    }
  };

  // ── User form handlers ──
  const onUserChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setUserForm((prev) => {
      const n = { ...prev, [name]: value };
      if (name === "role" && value === "super_admin") n.companyId = "";
      return n;
    });
    setUserErr("");
    setUserOk("");
  };

  const submitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserErr("");
    setUserOk("");

    if (!userForm.firstName.trim()) {
      setUserErr("Nama depan wajib diisi");
      return;
    }
    if (!userForm.email.trim()) {
      setUserErr("Email wajib diisi");
      return;
    }
    if (!userForm.password) {
      setUserErr("Password wajib diisi");
      return;
    }
    if (userForm.password.length < 8) {
      setUserErr("Password minimal 8 karakter");
      return;
    }
    if (userForm.role !== "super_admin" && !userForm.companyId) {
      setUserErr("Pilih company");
      return;
    }

    setUserBusy(true);
    const body: Record<string, unknown> = {
      firstName: userForm.firstName.trim(),
      email: userForm.email.trim(),
      password: userForm.password,
      role: userForm.role,
    };
    if (userForm.lastName.trim()) body.lastName = userForm.lastName.trim();
    if (userForm.role !== "super_admin") body.companyId = userForm.companyId;

    const { ok, data } = await apiPost("/admin/users", body);
    if (ok) {
      setUserOk(`User "${data.user.firstName}" berhasil dibuat!`);
      setUserForm(EMPTY_USER);
      refreshAll();
    } else {
      setUserErr(data?.error?.message ?? "Gagal membuat user");
    }
    setUserBusy(false);
  };

  // ── Company form handlers ──
  const onCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCompanyForm((prev) => {
      const n = { ...prev, [name]: value };
      if (name === "name" && !companyForm.slug) {
        n.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 50);
      }
      return n;
    });
    setCompanyErr("");
    setCompanyOk("");
  };

  const submitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyErr("");
    setCompanyOk("");

    if (!companyForm.name.trim()) {
      setCompanyErr("Nama company wajib diisi");
      return;
    }
    if (!companyForm.slug.trim()) {
      setCompanyErr("Slug wajib diisi");
      return;
    }
    if (!companyForm.ownerFirstName.trim()) {
      setCompanyErr("Nama depan owner wajib diisi");
      return;
    }
    if (!companyForm.ownerEmail.trim()) {
      setCompanyErr("Email owner wajib diisi");
      return;
    }
    if (!companyForm.ownerPassword) {
      setCompanyErr("Password owner wajib diisi");
      return;
    }

    setCompanyBusy(true);
    const body = {
      name: companyForm.name.trim(),
      slug: companyForm.slug.trim(),
      address: companyForm.address.trim() || undefined,
      phone: companyForm.phone.trim() || undefined,
      ownerFirstName: companyForm.ownerFirstName.trim(),
      ownerLastName: companyForm.ownerLastName.trim() || undefined,
      ownerEmail: companyForm.ownerEmail.trim(),
      ownerPassword: companyForm.ownerPassword,
    };

    const { ok, data } = await apiPost("/auth/register-company", body);
    if (ok) {
      setCompanyOk(`Company "${data.company.name}" berhasil dibuat!`);
      setCompanyForm(EMPTY_COMPANY);
      refreshAll();
    } else {
      setCompanyErr(data?.error?.message ?? "Gagal membuat company");
    }
    setCompanyBusy(false);
  };

  // ── Action Handlers ──
  const handleUserDeactivate = (user: User) => {
    setSelectedUser(user);
    setDialogType("user");
    setDialogMode("soft");
    setDialogOpen(true);
    setDialogError("");
  };

  const handleUserActivate = async (user: User) => {
    if (!confirm(`Aktifkan kembali user "${user.first_name} ${user.last_name}"?`)) return;
    const { ok, data } = await apiPatch(`/admin/users/${user.id}/activate`, {});
    if (ok) {
      refreshAll();
    } else {
      alert(data?.error?.message ?? "Gagal mengaktifkan user");
    }
  };

  const handleUserPermanentDelete = (user: User) => {
    setSelectedUser(user);
    setDialogType("user");
    setDialogMode("hard");
    setDialogOpen(true);
    setDialogError("");
  };

  const handleCompanySuspend = (company: Company) => {
    setSelectedCompany(company);
    setDialogType("company");
    setDialogMode("soft");
    setDialogOpen(true);
    setDialogError("");
  };

  const handleCompanyActivate = async (company: Company) => {
    if (!confirm(`Aktifkan kembali company "${company.name}"?`)) return;
    const { ok, data } = await apiPatch(`/companies/${company.id}/activate`, {});
    if (ok) {
      refreshAll();
    } else {
      alert(data?.error?.message ?? "Gagal mengaktifkan company");
    }
  };

  const handleCompanyPermanentDelete = (company: Company) => {
    setSelectedCompany(company);
    setDialogType("company");
    setDialogMode("hard");
    setDialogOpen(true);
    setDialogError("");
  };

  const handleDialogConfirm = async (confirmationName?: string) => {
    setDialogBusy(true);
    setDialogError("");

    try {
      if (dialogType === "user" && selectedUser) {
        if (dialogMode === "soft") {
          const { ok, data } = await apiDelete(`/admin/users/${selectedUser.id}`);
          if (ok) {
            setDialogOpen(false);
            refreshAll();
          } else {
            setDialogError(data?.error?.message ?? "Gagal menonaktifkan user");
          }
        } else {
          const { ok, data } = await apiDelete(`/admin/users/${selectedUser.id}/permanent`, {
            confirmation_name: confirmationName,
          });
          if (ok) {
            setDialogOpen(false);
            refreshAll();
          } else {
            setDialogError(data?.error?.message ?? "Gagal menghapus permanen user");
          }
        }
      } else if (dialogType === "company" && selectedCompany) {
        if (dialogMode === "soft") {
          const { ok, data } = await apiDelete(`/companies/${selectedCompany.id}`);
          if (ok) {
            setDialogOpen(false);
            refreshAll();
          } else {
            setDialogError(data?.error?.message ?? "Gagal menonaktifkan company");
          }
        } else {
          const { ok, data } = await apiDelete(`/companies/${selectedCompany.id}/permanent`, {
            confirmation_name: confirmationName,
          });
          if (ok) {
            setDialogOpen(false);
            refreshAll();
          } else {
            setDialogError(data?.error?.message ?? "Gagal menghapus permanen company");
          }
        }
      }
    } catch {
      setDialogError("Terjadi kesalahan koneksi");
    } finally {
      setDialogBusy(false);
    }
  };

  const activeCompanies = companies.filter((c) => c.status === "active");

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <PageContainer maxWidth="6xl">
        <PageHeader
          title="Super Admin Dashboard"
          subtitle="Kelola dan pantau seluruh pengguna, penyewa (company), dan status sistem FitSense"
          right={
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  setShowCompanyForm(!showCompanyForm);
                  setShowUserForm(false);
                  setCompanyErr("");
                  setCompanyOk("");
                }}
                style={{
                  padding: "9px 18px",
                  background: showCompanyForm ? "#6b7280" : "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {showCompanyForm ? "✕ Tutup Form" : "+ Buat Company"}
              </button>
              <button
                onClick={() => {
                  setShowUserForm(!showUserForm);
                  setShowCompanyForm(false);
                  setUserErr("");
                  setUserOk("");
                  setUserForm(EMPTY_USER);
                }}
                style={{
                  padding: "9px 18px",
                  background: showUserForm ? "#6b7280" : "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {showUserForm ? "✕ Tutup Form" : "+ Buat User"}
              </button>
            </div>
          }
        />

        <PageSection>
          {/* Stats Cards */}
          <AdminStatsBar
            totalUsers={stats.total_users}
            activeUsers={stats.active_users}
            totalCompanies={stats.total_companies}
            inactiveUsers={stats.inactive_users}
          />

          {/* ── Company Form ── */}
          {showCompanyForm && (
            <div style={{ marginBottom: "24px" }}>
              <Card>
                <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 18, color: "#059669" }}>
                  Daftar Company Baru
                </h2>
              <form onSubmit={submitCompany} noValidate>
                <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>Data Company</p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px 20px",
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <label style={labelStyle} htmlFor="c-name">
                      Nama Company <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      id="c-name"
                      name="name"
                      type="text"
                      value={companyForm.name}
                      onChange={onCompanyChange}
                      placeholder="Contoh: Gym Sehat"
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="c-slug">
                      Slug <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      id="c-slug"
                      name="slug"
                      type="text"
                      value={companyForm.slug}
                      onChange={onCompanyChange}
                      placeholder="gym-sehat"
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="c-address">
                      Alamat
                    </label>
                    <input
                      id="c-address"
                      name="address"
                      type="text"
                      value={companyForm.address}
                      onChange={onCompanyChange}
                      placeholder="Jl. Contoh No. 1"
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="c-phone">
                      Telepon
                    </label>
                    <input
                      id="c-phone"
                      name="phone"
                      type="text"
                      value={companyForm.phone}
                      onChange={onCompanyChange}
                      placeholder="08xxxxxxxxxx"
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: 13,
                    color: "#6b7280",
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: 16,
                  }}
                >
                  Data Owner (Club Owner)
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px 20px",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label style={labelStyle} htmlFor="c-ownerFirstName">
                      Nama Depan Owner <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      id="c-ownerFirstName"
                      name="ownerFirstName"
                      type="text"
                      value={companyForm.ownerFirstName}
                      onChange={onCompanyChange}
                      placeholder="Contoh: Andi"
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="c-ownerLastName">
                      Nama Belakang Owner
                    </label>
                    <input
                      id="c-ownerLastName"
                      name="ownerLastName"
                      type="text"
                      value={companyForm.ownerLastName}
                      onChange={onCompanyChange}
                      placeholder="Contoh: Wijaya"
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="c-ownerEmail">
                      Email Owner <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      id="c-ownerEmail"
                      name="ownerEmail"
                      type="email"
                      value={companyForm.ownerEmail}
                      onChange={onCompanyChange}
                      placeholder="owner@gym.com"
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="c-ownerPassword">
                      Password Owner <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      id="c-ownerPassword"
                      name="ownerPassword"
                      type="password"
                      value={companyForm.ownerPassword}
                      onChange={onCompanyChange}
                      placeholder="Min. 8 karakter"
                      style={inputStyle}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <AlertBox type="error" msg={companyErr} />
                <AlertBox type="success" msg={companyOk} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="submit"
                    disabled={companyBusy}
                    style={{
                      padding: "10px 28px",
                      background: companyBusy ? "#6ee7b7" : "#059669",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: companyBusy ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {companyBusy ? "Menyimpan..." : "Buat Company"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompanyForm(false);
                      setCompanyForm(EMPTY_COMPANY);
                      setCompanyErr("");
                      setCompanyOk("");
                    }}
                    style={{
                      padding: "10px 20px",
                      background: "#f3f4f6",
                      color: "#374151",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    Batal
                  </button>
                </div>
              </form>
            </Card>
          </div>
          )}

          {/* ── User Form ── */}
          {showUserForm && (
            <div style={{ marginBottom: "24px" }}>
              <Card>
                <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 18, color: "#2563eb" }}>
                  Daftar User Baru
                </h2>
              <form onSubmit={submitUser} noValidate>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px 20px",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label style={labelStyle} htmlFor="u-firstName">
                      Nama Depan <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      id="u-firstName"
                      name="firstName"
                      type="text"
                      value={userForm.firstName}
                      onChange={onUserChange}
                      placeholder="Contoh: Budi"
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="u-lastName">
                      Nama Belakang
                    </label>
                    <input
                      id="u-lastName"
                      name="lastName"
                      type="text"
                      value={userForm.lastName}
                      onChange={onUserChange}
                      placeholder="Contoh: Santoso"
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="u-email">
                      Email <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      id="u-email"
                      name="email"
                      type="email"
                      value={userForm.email}
                      onChange={onUserChange}
                      placeholder="user@email.com"
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="u-password">
                      Password <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      id="u-password"
                      name="password"
                      type="password"
                      value={userForm.password}
                      onChange={onUserChange}
                      placeholder="Min. 8 karakter"
                      style={inputStyle}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="u-role">
                      Role <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      id="u-role"
                      name="role"
                      value={userForm.role}
                      onChange={onUserChange}
                      style={inputStyle}
                    >
                      <option value="member">Member</option>
                      <option value="trainer">Trainer</option>
                      <option value="club_owner">Club Owner</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  {userForm.role !== "super_admin" && (
                    <div>
                      <label style={labelStyle} htmlFor="u-companyId">
                        Company <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      {activeCompanies.length === 0 ? (
                        <div
                          style={{
                            padding: "8px 12px",
                            background: "#fef9c3",
                            border: "1px solid #fde047",
                            borderRadius: 6,
                            fontSize: 13,
                            color: "#854d0e",
                          }}
                        >
                          Belum ada company aktif. Buat company dulu.
                        </div>
                      ) : (
                        <select
                          id="u-companyId"
                          name="companyId"
                          value={userForm.companyId}
                          onChange={onUserChange}
                          style={inputStyle}
                        >
                          <option value="">-- Pilih Company --</option>
                          {activeCompanies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.slug})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
                <AlertBox type="error" msg={userErr} />
                <AlertBox type="success" msg={userOk} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="submit"
                    disabled={
                      userBusy ||
                      (userForm.role !== "super_admin" && activeCompanies.length === 0)
                    }
                    style={{
                      padding: "10px 28px",
                      background:
                        userBusy ||
                        (userForm.role !== "super_admin" && activeCompanies.length === 0)
                          ? "#93c5fd"
                          : "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {userBusy ? "Menyimpan..." : "Buat User"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserForm(false);
                      setUserForm(EMPTY_USER);
                      setUserErr("");
                      setUserOk("");
                    }}
                    style={{
                      padding: "10px 20px",
                      background: "#f3f4f6",
                      color: "#374151",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    Batal
                  </button>
                </div>
              </form>
            </Card>
          </div>
          )}

          {/* ── Tabs Navigation ── */}
          <div
            style={{
              display: "flex",
              borderBottom: "2px solid #e5e7eb",
              marginBottom: "20px",
            }}
          >
            {(["users", "companies"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "12px 24px",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid #2563eb" : "2px solid transparent",
                  marginBottom: -2,
                  background: "transparent",
                  color: activeTab === tab ? "#2563eb" : "#6b7280",
                  fontWeight: activeTab === tab ? 600 : 500,
                  cursor: "pointer",
                  fontSize: 14,
                  transition: "all 0.2s",
                }}
              >
                {tab === "users" ? "Users" : "Companies"}
              </button>
            ))}
          </div>

          {/* ── Users Tab Content ── */}
          {activeTab === "users" && (
            <>
              {/* Users Filter Bar */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginBottom: "16px",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau email..."
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    width: "220px",
                  }}
                />

                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setUsersPage(1);
                  }}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: "#fff",
                  }}
                >
                  <option value="">All Roles</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="club_owner">Club Owner</option>
                  <option value="trainer">Trainer</option>
                  <option value="member">Member</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setUsersPage(1);
                  }}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: "#fff",
                  }}
                >
                  <option value="">Semua Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <select
                  value={companyFilter}
                  onChange={(e) => {
                    setCompanyFilter(e.target.value);
                    setUsersPage(1);
                  }}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: "#fff",
                    maxWidth: "200px",
                  }}
                >
                  <option value="">Semua Company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Limit Selector */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>Tampilkan:</span>
                  <select
                    value={usersLimit}
                    onChange={(e) => {
                      setUsersLimit(Number(e.target.value));
                      setUsersPage(1);
                    }}
                    style={{
                      padding: "6px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "13px",
                      backgroundColor: "#fff",
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <Card>
                {usersLoading ? (
                  <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                    Memuat data...
                  </div>
                ) : (
                  <UserTable
                    users={users}
                    startIndex={(usersPage - 1) * usersLimit + 1}
                    onDeactivate={handleUserDeactivate}
                    onActivate={handleUserActivate}
                    onPermanentDelete={handleUserPermanentDelete}
                  />
                )}
              </Card>

              <Pagination
                total={usersTotal}
                page={usersPage}
                limit={usersLimit}
                pages={usersPages}
                onPageChange={setUsersPage}
                entityLabel="pengguna"
              />
            </>
          )}

          {/* ── Companies Tab Content ── */}
          {activeTab === "companies" && (
            <Card>
              {companiesLoading ? (
                <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                  Memuat data...
                </div>
              ) : (
                <CompanyTable
                  companies={companies}
                  startIndex={1}
                  onSuspend={handleCompanySuspend}
                  onActivate={handleCompanyActivate}
                  onPermanentDelete={handleCompanyPermanentDelete}
                />
              )}
            </Card>
          )}
        </PageSection>
      </PageContainer>

      {/* Delete / Suspend Confirm Dialog */}
      <DeleteConfirmDialog
        isOpen={dialogOpen}
        mode={dialogMode}
        entityType={dialogType}
        entityName={
          dialogType === "user"
            ? selectedUser
              ? `${selectedUser.first_name} ${selectedUser.last_name ?? ""}`.trim()
              : ""
            : selectedCompany
            ? selectedCompany.name
            : ""
        }
        onConfirm={handleDialogConfirm}
        onCancel={() => setDialogOpen(false)}
        isBusy={dialogBusy}
      />

      {/* Global Error Banner for Dialogs */}
      {dialogError && (
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
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        >
          {dialogError}
        </div>
      )}
    </div>
  );
}
