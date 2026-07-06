import React from "react";

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

interface UserTableProps {
  users: User[];
  startIndex: number;
  onDeactivate: (user: User) => void;
  onActivate: (user: User) => void;
  onPermanentDelete: (user: User) => void;
}

export default function UserTable({
  users,
  startIndex,
  onDeactivate,
  onActivate,
  onPermanentDelete,
}: UserTableProps) {
  const getRoleBadgeStyle = (role: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: "3px 8px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: 600,
      color: "#ffffff",
      textTransform: "capitalize",
    };

    switch (role) {
      case "super_admin":
        return { ...base, backgroundColor: "#F59E0B" }; // Kuning emas
      case "club_owner":
        return { ...base, backgroundColor: "#8B5CF6" }; // Ungu
      case "trainer":
        return { ...base, backgroundColor: "#10B981" }; // Hijau
      case "member":
        return { ...base, backgroundColor: "#3B82F6" }; // Biru
      default:
        return { ...base, backgroundColor: "#64748b" };
    }
  };

  const getStatusBadgeStyle = (status: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: "3px 8px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: 600,
      textTransform: "capitalize",
    };

    if (status === "active") {
      return { ...base, backgroundColor: "#dcfce7", color: "#15803d" }; // Hijau muda, hijau tua
    } else {
      return { ...base, backgroundColor: "#e2e8f0", color: "#475569" }; // Abu-abu muda, abu-abu tua
    }
  };

  const thStyle: React.CSSProperties = {
    padding: "12px 16px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
  };

  const tdStyle: React.CSSProperties = {
    padding: "16px",
    fontSize: "14px",
    color: "#334155",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <th style={thStyle}>#</th>
            <th style={thStyle}>Nama</th>
            <th style={thStyle}>Email</th>
            <th style={thStyle}>Role(s)</th>
            <th style={thStyle}>Company</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, index) => {
            const isInactive = u.status === "inactive";
            const isSuperAdmin = u.main_role === "super_admin";
            const fullName = `${u.first_name} ${u.last_name}`.trim();

            return (
              <tr
                key={u.id}
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  opacity: isInactive ? 0.5 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                <td style={{ ...tdStyle, color: "#64748b", fontWeight: 500 }}>
                  {startIndex + index}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0f172a" }}>
                  {fullName}
                </td>
                <td style={tdStyle}>{u.email}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {u.roles && u.roles.length > 0 ? (
                      u.roles.map((role) => (
                        <span key={role} style={getRoleBadgeStyle(role)}>
                          {role}
                        </span>
                      ))
                    ) : (
                      <span style={getRoleBadgeStyle("member")}>member</span>
                    )}
                  </div>
                </td>
                <td style={tdStyle}>
                  {isSuperAdmin ? (
                    <span style={{ color: "#64748b", fontStyle: "italic", fontWeight: 500 }}>
                      All Companies
                    </span>
                  ) : u.companies && u.companies.length > 0 ? (
                    u.companies.join(", ")
                  ) : (
                    "-"
                  )}
                </td>
                <td style={tdStyle}>
                  <span style={getStatusBadgeStyle(u.status)}>{u.status}</span>
                </td>
                <td style={tdStyle}>
                  {!isSuperAdmin ? (
                    <div style={{ display: "flex", gap: "8px" }}>
                      {u.status === "active" ? (
                        <button
                          onClick={() => onDeactivate(u)}
                          style={{
                            padding: "5px 12px",
                            backgroundColor: "#fee2e2", // Merah muda
                            color: "#dc2626",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Nonaktifkan
                        </button>
                      ) : (
                        <button
                          onClick={() => onActivate(u)}
                          style={{
                            padding: "5px 12px",
                            backgroundColor: "#dcfce7", // Hijau muda
                            color: "#15803d",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Aktifkan
                        </button>
                      )}
                      <button
                        onClick={() => onPermanentDelete(u)}
                        style={{
                          padding: "5px 12px",
                          backgroundColor: "#7f1d1d", // Merah tua
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Hapus Permanen
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
