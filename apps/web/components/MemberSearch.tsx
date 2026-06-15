"use client";
import React from "react";

interface MemberSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function MemberSearch({ value, onChange }: MemberSearchProps) {
  return (
    <div style={{ position: "relative" }}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cari member..."
        aria-label="Cari member"
        style={{
          width: "100%",
          padding: "11px 14px 11px 42px",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          fontSize: 14,
          background: "#fff",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "#3b82f6";
          e.target.style.boxShadow = "0 0 0 3px #3b82f620";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "#e2e8f0";
          e.target.style.boxShadow = "none";
        }}
      />
    </div>
  );
}
