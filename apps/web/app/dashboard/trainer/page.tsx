"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useMqtt } from "../../../hooks/useMqtt";
import MemberList, { MemberItem } from "../../../components/MemberList";
import MemberSearch from "../../../components/MemberSearch";
import AlertBanner, { Alert } from "../../../components/AlertBanner";
import ConnectionStatus from "../../../components/ConnectionStatus";
import type { HRZone } from "../../../components/HRZoneBadge";

/**
 * Trainer dashboard — subscribes fitsense/{club_id}/#, shows all members' HR.
 * Requirements: 13.2, 13.3, 13.4
 */
export default function TrainerDashboardPage() {
  const clubId =
    typeof window !== "undefined"
      ? (sessionStorage.getItem("clubId") ?? "")
      : "";

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const handleMessage = useCallback((topic: string, payload: Buffer) => {
    const parts = topic.split("/");
    // fitsense/{club_id}/{user_id}/hr  or  fitsense/{club_id}/{user_id}/alerts
    if (parts.length < 4) return;
    const userId = parts[2];
    const type = parts[3];

    try {
      const data = JSON.parse(payload.toString());

      if (type === "hr") {
        setMembers((prev) => {
          const existing = prev.find((m) => m.id === userId);
          const hrData = {
            hr: data.hr as number,
            zone: (data.hr_zone ?? "unknown") as HRZone,
            timestamp: data.timestamp as number,
          };
          if (existing) {
            return prev.map((m) => (m.id === userId ? { ...m, hrData } : m));
          }
          return [
            ...prev,
            { id: userId, name: `Member ${userId.slice(0, 8)}`, hrData },
          ];
        });
      }

      if (type === "alerts") {
        const alert: Alert = {
          id: `${userId}-${Date.now()}`,
          memberId: userId,
          memberName: `Member ${userId.slice(0, 8)}`,
          type: data.alert_type as "CRITICAL" | "WARNING",
          message: data.alert_message as string,
          timestamp: Date.now(),
        };
        setAlerts((prev) => [alert, ...prev].slice(0, 20));
      }
    } catch {
      // Ignore malformed messages
    }
  }, []);

  const { status, subscribe } = useMqtt({ onMessage: handleMessage });

  useEffect(() => {
    if (status === "connected" && clubId) {
      subscribe(`fitsense/${clubId}/#`);
    }
  }, [status, clubId, subscribe]);

  const filteredMembers = searchQuery
    ? members.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : members;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1>Dashboard Trainer</h1>
        <ConnectionStatus status={status} />
      </div>

      <AlertBanner
        alerts={alerts}
        onDismiss={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
      />

      <MemberSearch value={searchQuery} onChange={setSearchQuery} />

      {filteredMembers.length === 0 ? (
        <p style={{ color: "#9ca3af" }}>
          {members.length === 0
            ? "Menunggu data member..."
            : "Tidak ada member yang cocok."}
        </p>
      ) : (
        <MemberList members={filteredMembers} />
      )}
    </div>
  );
}
