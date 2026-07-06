import React from "react";

interface AdminStatsBarProps {
  totalUsers: number;
  activeUsers: number;
  totalCompanies: number;
  inactiveUsers: number;
}

export default function AdminStatsBar({
  totalUsers,
  activeUsers,
  totalCompanies,
  inactiveUsers,
}: AdminStatsBarProps) {
  const cards = [
    { label: "Total Users", value: totalUsers, color: "#2563eb", icon: "👥" },
    { label: "Active", value: activeUsers, color: "#16a34a", icon: "🟢" },
    { label: "Companies", value: totalCompanies, color: "#0d9488", icon: "🏢" },
    { label: "Inactive", value: inactiveUsers, color: "#475569", icon: "🔴" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "20px",
        marginBottom: "24px",
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>{card.label}</span>
            <span style={{ fontSize: "18px" }}>{card.icon}</span>
          </div>
          <span
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: card.color,
            }}
          >
            {card.value}
          </span>
        </div>
      ))}
    </div>
  );
}
