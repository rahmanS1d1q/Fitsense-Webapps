"use client";
import React from "react";

interface SubmitButtonProps {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
}

export default function SubmitButton({
  label,
  loading,
  loadingLabel,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: "100%",
        padding: "11px 24px",
        background: loading ? "var(--gray-300)" : "var(--brand-gradient)",
        color: "#fff",
        border: "none",
        borderRadius: "var(--radius-md)",
        cursor: loading ? "not-allowed" : "pointer",
        fontWeight: 600,
        fontSize: 14,
        marginTop: 8,
        boxShadow: loading ? "none" : "0 1px 3px rgba(37, 99, 235, 0.4)",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {loading ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 14,
              height: 14,
              border: "2px solid rgba(255,255,255,0.4)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          {loadingLabel ?? "Menyimpan..."}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
