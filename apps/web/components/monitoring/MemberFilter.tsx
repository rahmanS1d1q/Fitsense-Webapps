"use client";
import React from "react";

export type StatusFilter = "all" | "active" | "none";
export type ZoneFilter =
  | "all"
  | "rest"
  | "fat_burn"
  | "cardio"
  | "aerobic"
  | "peak";
export type AlertFilter = "all" | "has" | "none";
export type SortBy = "name" | "hr" | "duration" | "priority";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  zone: ZoneFilter;
  onZone: (v: ZoneFilter) => void;
  alert: AlertFilter;
  onAlert: (v: AlertFilter) => void;
  sort: SortBy;
  onSort: (v: SortBy) => void;
}

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  fontSize: 13,
  background: "#fff",
  color: "#374151",
  cursor: "pointer",
  outline: "none",
};

export default function MemberFilter(p: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: 20,
      }}
    >
      <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={p.search}
          onChange={(e) => p.onSearch(e.target.value)}
          placeholder="Cari nama member..."
          style={{
            width: "100%",
            padding: "8px 12px 8px 38px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 13,
            boxSizing: "border-box",
            outline: "none",
          }}
        />
      </div>

      <select
        value={p.status}
        onChange={(e) => p.onStatus(e.target.value as StatusFilter)}
        style={selectStyle}
      >
        <option value="all">Semua Status</option>
        <option value="active">Active Session</option>
        <option value="none">No Session</option>
      </select>

      <select
        value={p.zone}
        onChange={(e) => p.onZone(e.target.value as ZoneFilter)}
        style={selectStyle}
      >
        <option value="all">Semua Zona</option>
        <option value="rest">Rest</option>
        <option value="fat_burn">Fat Burn</option>
        <option value="cardio">Cardio</option>
        <option value="aerobic">Aerobic</option>
        <option value="peak">Peak</option>
      </select>

      <select
        value={p.alert}
        onChange={(e) => p.onAlert(e.target.value as AlertFilter)}
        style={selectStyle}
      >
        <option value="all">Semua Alert</option>
        <option value="has">Ada Alert</option>
        <option value="none">Tanpa Alert</option>
      </select>

      <select
        value={p.sort}
        onChange={(e) => p.onSort(e.target.value as SortBy)}
        style={selectStyle}
      >
        <option value="priority">Sort: Prioritas</option>
        <option value="name">Sort: Nama</option>
        <option value="hr">Sort: HR</option>
        <option value="duration">Sort: Durasi</option>
      </select>
    </div>
  );
}
