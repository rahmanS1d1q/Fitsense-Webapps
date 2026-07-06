import React from "react";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  member_count: string | number;
  trainer_count: string | number;
  created_at: string;
}

interface CompanyTableProps {
  companies: Company[];
  startIndex: number;
  onSuspend: (company: Company) => void;
  onActivate: (company: Company) => void;
  onPermanentDelete: (company: Company) => void;
}

export default function CompanyTable({
  companies,
  startIndex,
  onSuspend,
  onActivate,
  onPermanentDelete,
}: CompanyTableProps) {
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
            <th style={thStyle}>Slug</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Jumlah Member</th>
            <th style={thStyle}>Jumlah Trainer</th>
            <th style={thStyle}>Dibuat</th>
            <th style={thStyle}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c, index) => {
            const isSuspended = c.status === "suspended";

            return (
              <tr
                key={c.id}
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  opacity: isSuspended ? 0.5 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                <td style={{ ...tdStyle, color: "#64748b", fontWeight: 500 }}>
                  {startIndex + index}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0f172a" }}>
                  {c.name}
                </td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "13px" }}>{c.slug}</td>
                <td style={tdStyle}>
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
                <td style={{ ...tdStyle, textAlign: "center" }}>{c.member_count}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{c.trainer_count}</td>
                <td style={tdStyle}>
                  {c.created_at ? new Date(c.created_at).toLocaleDateString("id-ID") : "-"}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {!isSuspended ? (
                      <button
                        onClick={() => onSuspend(c)}
                        style={{
                          padding: "5px 12px",
                          backgroundColor: "#ffedd5", // Oranye muda
                          color: "#ea580c", // Oranye
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        onClick={() => onActivate(c)}
                        style={{
                          padding: "5px 12px",
                          backgroundColor: "#dcfce7", // Hijau muda
                          color: "#15803d", // Hijau
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
                      onClick={() => onPermanentDelete(c)}
                      style={{
                        padding: "5px 12px",
                        backgroundColor: "#dc2626", // Merah
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
