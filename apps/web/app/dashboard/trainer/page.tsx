"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useMqtt } from "../../../hooks/useMqtt";
import MemberList, { MemberItem } from "../../../components/MemberList";
import MemberSearch from "../../../components/MemberSearch";
import AlertBanner, { Alert } from "../../../components/AlertBanner";
import ConnectionStatus from "../../../components/ConnectionStatus";
import Navbar from "../../../components/Navbar";
import PageHeader from "../../../components/PageHeader";
import {
  PageContainer,
  PageSection,
  Card,
} from "../../../components/layout/PageContainer";
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
      <PageContainer>
        <PageHeader
          title="Live Monitoring"
          subtitle="Pantau heart rate semua member secara real-time"
          right={<ConnectionStatus status={status} />}
        />

        <PageSection>
          {/* Stats */}
          <div className="stats-grid">
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
              <div key={stat.label} className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">{stat.label}</span>
                  <span className="stat-icon">{stat.icon}</span>
                </div>
                <div className="stat-value" style={{ color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </PageSection>

        <PageSection>
          <AlertBanner
            alerts={alerts}
            onDismiss={(id) =>
              setAlerts((prev) => prev.filter((a) => a.id !== id))
            }
          />

          <div className="mb-4">
            <MemberSearch value={searchQuery} onChange={setSearchQuery} />
          </div>

          {filteredMembers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📡</div>
              <p className="empty-state-title">
                {members.length === 0
                  ? "Menunggu data member..."
                  : "Tidak ada member yang cocok"}
              </p>
              <p className="empty-state-description">
                {members.length === 0
                  ? "Data akan muncul saat member memulai sesi latihan"
                  : "Coba ubah kata kunci pencarian"}
              </p>
            </div>
          ) : (
            <MemberList members={filteredMembers} />
          )}
        </PageSection>
      </PageContainer>
    </>
  );
}
