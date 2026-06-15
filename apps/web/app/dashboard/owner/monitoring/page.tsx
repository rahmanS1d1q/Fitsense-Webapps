"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../../../../components/Navbar";
import PageHeader from "../../../../components/PageHeader";
import ConnectionStatus from "../../../../components/monitoring/ConnectionStatus";
import StatsBar from "../../../../components/monitoring/StatsBar";
import AlertBanner from "../../../../components/monitoring/AlertBanner";
import MemberCard, {
  MonitoringMember,
  MonitoringSession,
} from "../../../../components/monitoring/MemberCard";
import MemberFilter, {
  StatusFilter,
  ZoneFilter,
  AlertFilter,
  SortBy,
} from "../../../../components/monitoring/MemberFilter";
import MemberDetailDrawer from "../../../../components/monitoring/MemberDetailDrawer";
import { useMonitoringMqtt } from "../../../../hooks/useMonitoringMqtt";
import { apiGet, getCompanyId } from "../../../../lib/api";

export default function OwnerMonitoringPage() {
  const companyId = getCompanyId();
  const {
    liveHRMap,
    hrBufferMap,
    alertMap,
    connectionStatus,
    activeAlerts,
    dismissAlert,
    version,
  } = useMonitoringMqtt();

  const [members, setMembers] = useState<MonitoringMember[]>([]);
  const [sessionMap, setSessionMap] = useState<Map<string, MonitoringSession>>(
    new Map(),
  );
  const [detailId, setDetailId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<StatusFilter>("all");
  const [zoneF, setZoneF] = useState<ZoneFilter>("all");
  const [alertF, setAlertF] = useState<AlertFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("priority");

  // Load members + active sessions
  const loadData = useCallback(async () => {
    if (!companyId) return;
    const [membersRes, sessionsRes] = await Promise.all([
      apiGet(`/companies/${companyId}/members`),
      apiGet(`/companies/${companyId}/sessions/active`),
    ]);
    if (membersRes.ok) {
      const onlyMembers = (membersRes.data.members ?? []).filter(
        (m: { role: string }) => m.role === "member",
      );
      setMembers(onlyMembers);
    }
    if (sessionsRes.ok) {
      const map = new Map<string, MonitoringSession>();
      (sessionsRes.data.sessions ?? []).forEach(
        (s: MonitoringSession & { user_id: string }) => map.set(s.user_id, s),
      );
      setSessionMap(map);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  // Refresh active sessions every 30s
  useEffect(() => {
    const t = setInterval(loadData, 30000);
    return () => clearInterval(t);
  }, [loadData]);

  const nameOf = useCallback(
    (userId: string) => {
      const m = members.find((x) => x.id === userId);
      return m ? `${m.first_name} ${m.last_name}`.trim() : "Member";
    },
    [members],
  );

  // Critical alerts in last hour
  const criticalCount = useMemo(() => {
    const oneHourAgo = Date.now() - 3600000;
    let c = 0;
    alertMap.forEach((a) => {
      if (a.type === "CRITICAL" && a.timestamp > oneHourAgo) c++;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, alertMap]);

  // Filter + sort
  const visibleMembers = useMemo(() => {
    let list = [...members];

    if (search)
      list = list.filter((m) =>
        `${m.first_name} ${m.last_name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
    if (statusF === "active") list = list.filter((m) => sessionMap.has(m.id));
    if (statusF === "none") list = list.filter((m) => !sessionMap.has(m.id));
    if (zoneF !== "all")
      list = list.filter((m) => liveHRMap.get(m.id)?.hr_zone === zoneF);
    if (alertF === "has") list = list.filter((m) => alertMap.has(m.id));
    if (alertF === "none") list = list.filter((m) => !alertMap.has(m.id));

    const priority = (id: string) => {
      if (alertMap.get(id)?.type === "CRITICAL") return 0;
      if (alertMap.get(id)?.type === "WARNING") return 1;
      if (sessionMap.has(id)) return 2;
      return 3;
    };

    list.sort((a, b) => {
      if (sortBy === "name")
        return `${a.first_name}`.localeCompare(`${b.first_name}`);
      if (sortBy === "hr")
        return (liveHRMap.get(b.id)?.hr ?? 0) - (liveHRMap.get(a.id)?.hr ?? 0);
      if (sortBy === "duration") {
        const da = sessionMap.get(a.id)
          ? Date.now() - new Date(sessionMap.get(a.id)!.started_at).getTime()
          : 0;
        const db = sessionMap.get(b.id)
          ? Date.now() - new Date(sessionMap.get(b.id)!.started_at).getTime()
          : 0;
        return db - da;
      }
      return priority(a.id) - priority(b.id);
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, sessionMap, search, statusF, zoneF, alertF, sortBy, version]);

  const detailMember = members.find((m) => m.id === detailId) ?? null;

  return (
    <>
      <Navbar />
      <AlertBanner
        alerts={activeAlerts}
        nameOf={nameOf}
        onDismiss={dismissAlert}
      />

      <div style={{ padding: "32px", maxWidth: 1280, margin: "0 auto" }}>
        <PageHeader
          title="Live Monitoring"
          subtitle="Pantau detak jantung member secara real-time"
          right={<ConnectionStatus status={connectionStatus} />}
        />

        <StatsBar
          totalMembers={members.length}
          activeSessions={sessionMap.size}
          criticalAlerts={criticalCount}
        />

        <MemberFilter
          search={search}
          onSearch={setSearch}
          status={statusF}
          onStatus={setStatusF}
          zone={zoneF}
          onZone={setZoneF}
          alert={alertF}
          onAlert={setAlertF}
          sort={sortBy}
          onSort={setSortBy}
        />

        {visibleMembers.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.4 }}>
              📡
            </div>
            <p style={{ fontSize: 15, color: "#64748b", fontWeight: 500 }}>
              {members.length === 0
                ? "Belum ada member"
                : "Tidak ada yang cocok dengan filter"}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {visibleMembers.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                session={sessionMap.get(m.id) ?? null}
                liveHR={liveHRMap.get(m.id) ?? null}
                buffer={hrBufferMap.get(m.id) ?? []}
                hasAlert={alertMap.has(m.id)}
                alertType={alertMap.get(m.id)?.type ?? null}
                onDetail={setDetailId}
              />
            ))}
          </div>
        )}
      </div>

      {detailMember && (
        <MemberDetailDrawer
          member={detailMember}
          session={sessionMap.get(detailMember.id) ?? null}
          liveHR={liveHRMap.get(detailMember.id) ?? null}
          buffer={hrBufferMap.get(detailMember.id) ?? []}
          onClose={() => setDetailId(null)}
        />
      )}
    </>
  );
}

