"use client";

import React from "react";

interface MemberSearchProps {
  value: string;
  onChange: (query: string) => void;
  placeholder?: string;
}

/**
 * Local filter input — no server request.
 * Requirements: 13.9
 */
export default function MemberSearch({
  value,
  onChange,
  placeholder = "Cari member...",
}: MemberSearchProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "8px 12px",
        borderRadius: 6,
        border: "1px solid #d1d5db",
        fontSize: 14,
        marginBottom: 12,
      }}
      aria-label="Cari member berdasarkan nama"
    />
  );
}
