"use client";

import React, { useEffect, useState, useCallback } from "react";
import Navbar from "../../../components/Navbar";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  created_at: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  super_role: string | null;
  company_role: string | null;
  company_id: string | null;
  company_name: string | null;
  status: string;
  created_at: string;
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function getHeaders(): HeadersInit {
  const jwt = typeof window !== "undefined" ? sessionStorage.getItem("jwt") : null;
  return jwt
    ? { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

const EMPTY_USER: UserForm = { firstName: "", lastName: "", email: "", password: "", role: "member", companyId: "" };
const EMPTY_COMPANY: CompanyForm = { name: "", slug: "", address: "", phone: "", ownerFirstName: "", ownerLastName: "", ownerEmail: "", ownerPassword: "" };

const labelStyle: React.CSSProperties = { display: "block", marginBottom: 5, fontWeight: 500, fontSize: 13, color: "#374151" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };
const thStyle: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" };
const tdStyle: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };

function roleBadge(role: string) {
  const map: Record<string, { bg: string; color: string }> = {
    super_admin: { bg: "#fef3c7", color: "#92400e" },
    club_owner: { bg: "#dbeafe", color: "#1e40af" },
    trainer: { bg: "#d1fae5", color: "#065f46" },
    member: { bg: "#f3f4f6", color: "#374151" },
  };
  return map[role] ?? { bg: "#f3f4f6", color: "#6b7280" };
}

function statusBadge(status: string) {
  return status === "active"
    ? { bg: "#dcfce7", color: "#15803d" }
    : { bg: "#fee2e2", color: "#b91c1c" };
}

function AlertBox({ type, msg }: { type: "error" | "success"; msg: string }) {
  if (!msg) return null;
  const isErr = type === "error";
  return (
    <div style={{ padding: "10px 14px", background: isErr ? "#fef2f2" : "#f0fdf4", border: `1px solid ${isErr ? "#fecaca" : "#bbf7d0"}`, borderRadius: 6, color: isErr ? "#dc2626" : "#15803d", marginBottom: 14, fontSize: 14 }}>
      {isErr ? "✕ " : "✓ "}{msg}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "companies">("users");

  // User form
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState<UserForm>(EMPTY_USER);
  const [userErr, setUserErr] = useState("");
  const [userOk, setUserOk] = useState("");
  const [userBusy, setUserBusy] = useState(false);

  // Company form
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(EMPTY_COMPANY);
  const [companyErr, setCompanyErr] = useState("");
  const [companyOk, setCompanyOk] = useState("");
  const [companyBusy, setCompanyBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const h = getHeaders();
      const [cr, ur] = await Promise.all([
        fetch(`${API_URL}/admin/companies`, { headers: h }),
        fetch(`${API_URL}/admin/users`, { headers: h }),
      ]);
      if (!cr.ok || !ur.ok) { setPageError("Gagal memuat data. Pastikan login sebagai super_admin."); return; }
      const cd = await cr.json();
      const ud = await ur.json();
      setCompanies(cd.companies ?? []);
      setUsers(ud.users ?? []);
    } catch { setPageError("Tidak dapat terhubung ke server API."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── User form handlers ──
  const onUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserForm(prev => { const n = { ...prev, [name]: value }; if (name === "role" && value === "super_admin") n.companyId = ""; return n; });
    setUserErr(""); setUserOk("");
  };

  const submitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserErr(""); setUserOk("");
    if (!userForm.firstName.trim()) { setUserErr("Nama depan wajib diisi"); return; }
    if (!userForm.email.trim()) { setUserErr("Email wajib diisi"); return; }
    if (!userForm.password) { setUserErr("Password wajib diisi"); return; }
    if (userForm.password.length < 8) { setUserErr("Password minimal 8 karakter"); return; }
    if (userForm.role !== "super_admin" && !userForm.companyId) { setUserErr(companies.filter(c => c.status === "active").length === 0 ? "Belum ada company aktif. Buat company dulu." : "Pilih company"); return; }
    setUserBusy(true);
    try {
      const body: Record<string, unknown> = { firstName: userForm.firstName.trim(), email: userForm.email.trim(), password: userForm.password, role: userForm.role };
      if (userForm.lastName.trim()) body.lastName = userForm.lastName.trim();
      if (userForm.role !== "super_admin") body.companyId = userForm.companyId;
      const res = await fetch(`${API_URL}/admin/users`, { method: "POST", headers: getHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setUserErr(data?.error?.message ?? `Error ${res.status}`); return; }
      setUserOk(`User "${data.user.firstName} ${data.user.lastName ?? ""}".trim() berhasil dibuat (${data.user.role})`);
      setUserForm(EMPTY_USER);
      await loadData();
    } catch { setUserErr("Tidak dapat terhubung ke server."); }
    finally { setUserBusy(false); }
  };

  // ── Company form handlers ──
  const onCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCompanyForm(prev => {
      const n = { ...prev, [name]: value };
      if (name === "name" && !companyForm.slug) {
        n.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
      }
      return n;
    });
    setCompanyErr(""); setCompanyOk("");
  };

  const submitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyErr(""); setCompanyOk("");
    if (!companyForm.name.trim()) { setCompanyErr("Nama company wajib diisi"); return; }
    if (!companyForm.slug.trim()) { setCompanyErr("Slug wajib diisi"); return; }
    if (!/^[a-z0-9-]{3,50}$/.test(companyForm.slug)) { setCompanyErr("Slug hanya huruf kecil, angka, dan tanda hubung (3-50 karakter)"); return; }
    if (!companyForm.ownerFirstName.trim()) { setCompanyErr("Nama depan owner wajib diisi"); return; }
    if (!companyForm.ownerEmail.trim()) { setCompanyErr("Email owner wajib diisi"); return; }
    if (!companyForm.ownerPassword) { setCompanyErr("Password owner wajib diisi"); return; }
    if (companyForm.ownerPassword.length < 8) { setCompanyErr("Password owner minimal 8 karakter"); return; }
    setCompanyBusy(true);
    try {
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
      const res = await fetch(`${API_URL}/auth/register-company`, { method: "POST", headers: getHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setCompanyErr(data?.error?.message ?? `Error ${res.status}`); return; }
      setCompanyOk(`Company "${data.company.name}" berhasil dibuat! Owner: ${data.owner.email}`);
      setCompanyForm(EMPTY_COMPANY);
      await loadData();
    } catch { setCompanyErr("Tidak dapat terhubung ke server."); }
    finally { setCompanyBusy(false); }
  };

  const deactivateUser = async (id: string, name: string) => {
    if (!confirm(`Nonaktifkan user "${name}"?`)) return;
    const res = await fetch(`${API_URL}/admin/users/${id}`, { method: "DELETE", headers: getHeaders() });
    if (res.ok) loadData(); else alert("Gagal menonaktifkan user");
  };

  const activeCompanies = companies.filter(c => c.status === "active");

  if (loading) return <div><Navbar /><div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Memuat data...</div></div>;
  if (pageError) return <div><Navbar /><div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>{pageError}</div></div>;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <Navbar />
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>Admin Dashboard</h1>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setShowCompanyForm(!showCompanyForm); setShowUserForm(false); setCompanyErr(""); setCompanyOk(""); }} style={{ padding: "9px 18px", background: showCompanyForm ? "#6b7280" : "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              {showCompanyForm ? "✕ Tutup" : "+ Buat Company"}
            </button>
            <button onClick={() => { setShowUserForm(!showUserForm); setShowCompanyForm(false); setUserErr(""); setUserOk(""); setUserForm(EMPTY_USER); }} style={{ padding: "9px 18px", background: showUserForm ? "#6b7280" : "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              {showUserForm ? "✕ Tutup" : "+ Buat User"}
            </button>
          </div>
        </div>

        {/* ── Company Form ── */}
        {showCompanyForm && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 24, marginBottom: 24, boxShadow: "0 1px 6px rgba(0,0,0,0.08)" }}>
            <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 18, color: "#059669" }}>Daftar Company Baru</h2>
            <form onSubmit={submitCompany} noValidate>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>Data Company</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 20 }}>
                <div>
                  <label style={labelStyle} htmlFor="c-name">Nama Company <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="c-name" name="name" type="text" value={companyForm.name} onChange={onCompanyChange} placeholder="Contoh: Gym Sehat" style={inputStyle} autoComplete="off" />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="c-slug">Slug <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="c-slug" name="slug" type="text" value={companyForm.slug} onChange={onCompanyChange} placeholder="gym-sehat" style={inputStyle} autoComplete="off" />
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>Huruf kecil, angka, tanda hubung. Min 3 karakter.</p>
                </div>
                <div>
                  <label style={labelStyle} htmlFor="c-address">Alamat</label>
                  <input id="c-address" name="address" type="text" value={companyForm.address} onChange={onCompanyChange} placeholder="Jl. Contoh No. 1" style={inputStyle} autoComplete="off" />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="c-phone">Telepon</label>
                  <input id="c-phone" name="phone" type="text" value={companyForm.phone} onChange={onCompanyChange} placeholder="08xxxxxxxxxx" style={inputStyle} autoComplete="off" />
                </div>
              </div>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280", borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>Data Owner (Club Owner)</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 16 }}>
                <div>
                  <label style={labelStyle} htmlFor="c-ownerFirstName">Nama Depan Owner <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="c-ownerFirstName" name="ownerFirstName" type="text" value={companyForm.ownerFirstName} onChange={onCompanyChange} placeholder="Contoh: Andi" style={inputStyle} autoComplete="off" />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="c-ownerLastName">Nama Belakang Owner</label>
                  <input id="c-ownerLastName" name="ownerLastName" type="text" value={companyForm.ownerLastName} onChange={onCompanyChange} placeholder="Contoh: Wijaya" style={inputStyle} autoComplete="off" />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="c-ownerEmail">Email Owner <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="c-ownerEmail" name="ownerEmail" type="email" value={companyForm.ownerEmail} onChange={onCompanyChange} placeholder="owner@gym.com" style={inputStyle} autoComplete="off" />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="c-ownerPassword">Password Owner <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="c-ownerPassword" name="ownerPassword" type="password" value={companyForm.ownerPassword} onChange={onCompanyChange} placeholder="Min. 8 karakter" style={inputStyle} autoComplete="new-password" />
                </div>
              </div>
              <AlertBox type="error" msg={companyErr} />
              <AlertBox type="success" msg={companyOk} />
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" disabled={companyBusy} style={{ padding: "10px 28px", background: companyBusy ? "#6ee7b7" : "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: companyBusy ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14 }}>
                  {companyBusy ? "Menyimpan..." : "Buat Company"}
                </button>
                <button type="button" onClick={() => { setShowCompanyForm(false); setCompanyForm(EMPTY_COMPANY); setCompanyErr(""); setCompanyOk(""); }} style={{ padding: "10px 20px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── User Form ── */}
        {showUserForm && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 24, marginBottom: 24, boxShadow: "0 1px 6px rgba(0,0,0,0.08)" }}>
            <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 18, color: "#2563eb" }}>Daftar User Baru</h2>
            <form onSubmit={submitUser} noValidate>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 16 }}>
                <div>
                  <label style={labelStyle} htmlFor="u-firstName">Nama Depan <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="u-firstName" name="firstName" type="text" value={userForm.firstName} onChange={onUserChange} placeholder="Contoh: Budi" style={inputStyle} autoComplete="off" />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="u-lastName">Nama Belakang</label>
                  <input id="u-lastName" name="lastName" type="text" value={userForm.lastName} onChange={onUserChange} placeholder="Contoh: Santoso" style={inputStyle} autoComplete="off" />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="u-email">Email <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="u-email" name="email" type="email" value={userForm.email} onChange={onUserChange} placeholder="user@email.com" style={inputStyle} autoComplete="off" />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="u-password">Password <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="u-password" name="password" type="password" value={userForm.password} onChange={onUserChange} placeholder="Min. 8 karakter" style={inputStyle} autoComplete="new-password" />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="u-role">Role <span style={{ color: "#dc2626" }}>*</span></label>
                  <select id="u-role" name="role" value={userForm.role} onChange={onUserChange} style={inputStyle}>
                    <option value="member">Member</option>
                    <option value="trainer">Trainer</option>
                    <option value="club_owner">Club Owner</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                {userForm.role !== "super_admin" && (
                  <div>
                    <label style={labelStyle} htmlFor="u-companyId">Company <span style={{ color: "#dc2626" }}>*</span></label>
                    {activeCompanies.length === 0 ? (
                      <div style={{ padding: "8px 12px", background: "#fef9c3", border: "1px solid #fde047", borderRadius: 6, fontSize: 13, color: "#854d0e" }}>
                        Belum ada company aktif. Buat company dulu.
                      </div>
                    ) : (
                      <select id="u-companyId" name="companyId" value={userForm.companyId} onChange={onUserChange} style={inputStyle}>
                        <option value="">-- Pilih Company --</option>
                        {activeCompanies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.slug})</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>
              <AlertBox type="error" msg={userErr} />
              <AlertBox type="success" msg={userOk} />
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" disabled={userBusy || (userForm.role !== "super_admin" && activeCompanies.length === 0)} style={{ padding: "10px 28px", background: userBusy || (userForm.role !== "super_admin" && activeCompanies.length === 0) ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                  {userBusy ? "Menyimpan..." : "Buat User"}
                </button>
                <button type="button" onClick={() => { setShowUserForm(false); setUserForm(EMPTY_USER); setUserErr(""); setUserOk(""); }} style={{ padding: "10px 20px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 0 }}>
          {(["users", "companies"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "10px 24px", border: "none", borderBottom: activeTab === tab ? "2px solid #2563eb" : "2px solid transparent", marginBottom: -2, background: "transparent", color: activeTab === tab ? "#2563eb" : "#6b7280", fontWeight: activeTab === tab ? 600 : 400, cursor: "pointer", fontSize: 14 }}>
              {tab === "users" ? `Users (${users.length})` : `Companies (${companies.length})`}
            </button>
          ))}
        </div>

        {/* ── Users Table ── */}
        {activeTab === "users" && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle}>Nama</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Belum ada user</td></tr>
                ) : users.map(user => {
                  const role = user.super_role === "super_admin" ? "super_admin" : (user.company_role ?? "-");
                  const rb = roleBadge(role);
                  const sb = statusBadge(user.status);
                  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "-";
                  return (
                    <tr key={`${user.id}-${user.company_id ?? "x"}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={tdStyle}>{name}</td>
                      <td style={{ ...tdStyle, color: "#6b7280", fontSize: 13 }}>{user.email}</td>
                      <td style={tdStyle}><span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: rb.bg, color: rb.color }}>{role}</span></td>
                      <td style={{ ...tdStyle, color: "#6b7280", fontSize: 13 }}>{user.company_name ?? "-"}</td>
                      <td style={tdStyle}><span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: sb.bg, color: sb.color }}>{user.status}</span></td>
                      <td style={tdStyle}>
                        {user.status === "active" && role !== "super_admin" && (
                          <button onClick={() => deactivateUser(user.id, name)} style={{ padding: "4px 12px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Nonaktifkan</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Companies Table ── */}
        {activeTab === "companies" && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle}>Nama</th>
                  <th style={thStyle}>Slug</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Belum ada company. Klik "+ Buat Company" di atas.</td></tr>
                ) : companies.map(c => {
                  const sb = statusBadge(c.status);
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={tdStyle}>{c.name}</td>
                      <td style={{ ...tdStyle, color: "#6b7280", fontFamily: "monospace", fontSize: 13 }}>{c.slug}</td>
                      <td style={tdStyle}><span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: sb.bg, color: sb.color }}>{c.status}</span></td>
                      <td style={{ ...tdStyle, color: "#9ca3af", fontSize: 13 }}>{c.created_at ? new Date(c.created_at).toLocaleDateString("id-ID") : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
