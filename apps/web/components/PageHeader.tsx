"use client";
import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  right?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  action,
  right,
}: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 28,
        paddingBottom: 20,
        borderBottom: "1px solid var(--border-subtle)",
        flexWrap: "wrap",
        gap: 16,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 700,
            color: "var(--gray-900)",
            letterSpacing: "-0.5px",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 14,
              color: "var(--gray-500)",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {right}
        {action}
      </div>
    </div>
  );
}
