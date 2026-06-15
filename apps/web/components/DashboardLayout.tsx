"use client";

import React from "react";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg-page)",
      }}
    >
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 260, minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
