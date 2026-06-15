"use client";
import React, { useState } from "react";

interface Props {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  placeholder?: string;
}

function formatMac(raw: string): string {
  // Strip all non-hex chars, uppercase, group in pairs with ':'
  const hex = raw
    .replace(/[^0-9a-fA-F]/g, "")
    .toUpperCase()
    .slice(0, 12);
  return hex.match(/.{1,2}/g)?.join(":") ?? "";
}

export default function MacAddressInput({
  id,
  value,
  onChange,
  error,
  placeholder,
}: Props) {
  const [focused, setFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(formatMac(e.target.value));
  };

  return (
    <div>
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder ?? "AA:BB:CC:DD:EE:FF"}
        maxLength={17}
        style={{
          width: "100%",
          padding: "10px 14px",
          border: error
            ? "1.5px solid #dc2626"
            : focused
              ? "1.5px solid #2563eb"
              : "1.5px solid #e5e7eb",
          borderRadius: 8,
          fontSize: 14,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          letterSpacing: "0.05em",
          boxSizing: "border-box",
          outline: "none",
          background: "#fff",
          boxShadow:
            focused && !error ? "0 0 0 3px rgba(37,99,235,0.1)" : "none",
          transition: "all 0.15s ease",
        }}
      />
      {error && (
        <p
          style={{
            margin: "5px 0 0",
            fontSize: 12,
            color: "#dc2626",
            fontWeight: 500,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
