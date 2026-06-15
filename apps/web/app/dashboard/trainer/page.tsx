"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useMqtt } from "../../../hooks/useMqtt";
import MemberList, { MemberItem } from "../../../components/MemberList";
import MemberSearch from "../../../components/MemberSearch";
import AlertBanner, { Alert } from "../../../components/AlertBanner";
import ConnectionStatus from "../../../components/ConnectionStatus";
import Navbar from "../../../components/Navbar";
import PageHeader from "../../../components/PageHeader";
import type { HRZone } from "../../../components/HRZoneBadge";

export default function TrainerDashboardPage() {
  const companyId =
    typeof window !== "undefined"
      ? (sessionStorage.getItem("companyId") ?? "")
      : "";
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const handleMessage = useCallback((topic: string, payload: Buffer) => {
    const parts = topic.split("/");
    if (parts.length < 4) return;
    const userId = parts[2];
    const type = parts[3];
    try {
      const data = JSON.parse(payload.toString());
      if (type === "hr") {
        setMembers((prev) => {
          const hrData = {
            hr: data.hr as number,
            zone: (data.hr_zone ?? "unknown") as HRZone,
            timestamp: data.timestamp as number,
          };
          const existing = prev.find((m) => m.id === userId);
          if (existing)
            return prev.map((m) => (m.id === userId ? { ...m, hrData } : m));
          return [
            ...prev,
            { id: userId, name: `Member ${userId.slice(0, 8)}`, hrData },
          ];
        });
      }
      if (type === "alerts") {
        setAlerts((prev) =>
          [
            {
              id: `${userId}-${Date.now()}`,
              memberId: userId,
              memberName: `Member ${userId.slice(0, 8)}`,
              type: data.alert_type as "CRITICAL" | "WARNING",
              message: data.alert_message as string,
              timestamp: Date.now(),
            },
            ...prev,
          ].slice(0, 20),
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const { status, subscribe } = useMqtt({ onMessage: handleMessage });

  useEffect(() => {
    if (status === "connected" && companyId)
      subscribe(`fitsense/${companyId}/#`);
  }, [status, companyId, subscribe]);

  const filteredMembers = searchQuery
    ? members.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : members;

  const activeCount = members.filter((m) => m.hrData).length;

  return (
    <>
      <Navbar />
      <div style={{ padding: "32px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <PageHeader
          title="Live Monitoring"
          subtitle="Pantau heart rate semua member secara real-time"
          right={<ConnectionStatus status={status} />}
        />

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {[
            {
              label: "Total Member",
              value: members.length,
              color: "var(--brand-600)",
              icon: "👥",
            },
            {
              label: "Sedang Aktif",
              value: activeCount,
              color: "var(--success-600)",
              icon: "🟢",
            },
            {
              label: "Alerts Aktif",
              value: alerts.length,
              color: "var(--danger-600)",
              icon: "🚨",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                padding: 20,
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--gray-500)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {stat.label}
                </span>
                <span style={{ fontSize: 18 }}>{stat.icon}</span>
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: stat.color,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.5px",
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <AlertBanner
          alerts={alerts}
          onDismiss={(id) =>
            setAlerts((prev) => prev.filter((a) => a.id !== id))
          }
        />

        <div style={{ marginBottom: 16 }}>
          <MemberSearch value={searchQuery} onChange={setSearchQuery} />
        </div>

        {filteredMembers.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>
              📡
            </div>
            <p
              style={{
                fontSize: 16,
                color: "var(--gray-700)",
                fontWeight: 500,
                margin: 0,
              }}
            >
              {members.length === 0
                ? "Menunggu data member..."
                : "Tidak ada member yang cocok"}
            </p>
            <p style={{ fontSize: 13, color: "var(--gray-400)", marginTop: 6 }}>
              {members.length === 0
                ? "Data akan muncul saat member memulai sesi latihan"
                : "Coba ubah kata kunci pencarian"}
            </p>
          </div>
        ) : (
          <MemberList members={filteredMembers} />
        )}
      </div>
    </>
  );
}
