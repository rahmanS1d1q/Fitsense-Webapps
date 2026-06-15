"use client";
import React from "react";

interface FormCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function FormCard({ title, subtitle, children }: FormCardProps) {
  return (
    <div style={{ maxWidth: 640, margin: "32px auto", padding: "0 24px" }}>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)",
          padding: 32,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <h1
          style={{
            margin: "0 0 6px",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--gray-900)",
            letterSpacing: "-0.4px",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: "0 0 28px",
              fontSize: 14,
              color: "var(--gray-500)",
            }}
          >
            {subtitle}
          </p>
        )}
        {!subtitle && <div style={{ marginBottom: 24 }} />}
        {children}
      </div>
    </div>
  );
}
