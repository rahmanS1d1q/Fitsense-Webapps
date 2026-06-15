"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useMqtt } from "../../../hooks/useMqtt";
import HRZoneBadge, { HRZone } from "../../../components/HRZoneBadge";
import AlertBanner, { Alert } from "../../../components/AlertBanner";
import ConnectionStatus from "../../../components/ConnectionStatus";
import Navbar from "../../../components/Navbar";
import PageHeader from "../../../components/PageHeader";
import { apiPost } from "../../../lib/api";

export default function MemberDashboardPage() {
  const companyId =
    typeof window !== "undefined"
      ? (sessionStorage.getItem("companyId") ?? "")
      : "";
  const userId =
    typeof window !== "undefined"
      ? (sessionStorage.getItem("userId") ?? "")
      : "";

  const [hr, setHr] = useState<number | null>(null);
  const [zone, setZone] = useState<HRZone>("unknown");
  const [sessionStart] = useState<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionMsg, setSessionMsg] = useState("");

  useEffect(() => {
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - sessionStart) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [sessionStart]);

  const handleMessage = useCallback(
    (topic: string, payload: Buffer) => {
      const parts = topic.split("/");
      if (parts.length < 4) return;
      const type = parts[3];
      try {
        const data = JSON.parse(payload.toString());
        if (type === "hr") {
          setHr(data.hr as number);
          setZone((data.hr_zone ?? "unknown") as HRZone);
        }
        if (type === "alerts") {
          setAlerts((prev) =>
            [
              {
                id: `${Date.now()}`,
                memberId: userId,
                memberName: "Saya",
                type: data.alert_type as "CRITICAL" | "WARNING",
                message: data.alert_message as string,
                timestamp: Date.now(),
              },
              ...prev,
            ].slice(0, 5),
          );
        }
      } catch {
        /* ignore */
      }
    },
    [userId],
  );

  const { status, subscribe } = useMqtt({ onMessage: handleMessage });

  useEffect(() => {
    if (status === "connected" && companyId && userId) {
      subscribe(`fitsense/${companyId}/${userId}/hr`);
      subscribe(`fitsense/${companyId}/${userId}/alerts`);
    }
  }, [status, companyId, userId, subscribe]);

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0)
      return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const getHRColor = () => {
    if (!hr) return "var(--gray-500)";
    if (hr < 100) return "var(--brand-600)";
    if (hr < 140) return "var(--success-600)";
    if (hr < 170) return "var(--warning-600)";
    return "var(--danger-600)";
  };

  const handleStartSession = async () => {
    setSessionBusy(true);
    setSessionMsg("");
    const { ok, status: code, data } = await apiPost("/sessions/start", {});
    setSessionBusy(false);
    if (ok) {
      setActiveSessionId(data.session?.id ?? null);
      setSessionMsg("Sesi dimulai. Mulai kirim data HR dari sensor.");
    } else if (code === 409) {
      setActiveSessionId(data.activeSessionId ?? null);
      setSessionMsg("Sesi aktif sudah ada.");
    } else {
      setSessionMsg(data?.error?.message ?? "Gagal memulai sesi.");
    }
  };

  const handleEndSession = async () => {
    if (!activeSessionId) return;
    setSessionBusy(true);
    setSessionMsg("");
    const { ok, data } = await apiPost("/sessions/end", {
      sessionId: activeSessionId,
    });
    setSessionBusy(false);
    if (ok) {
      setActiveSessionId(null);
      setSessionMsg("Sesi selesai.");
    } else {
      setSessionMsg(data?.error?.message ?? "Gagal mengakhiri sesi.");
    }
  };

  return (
    <>
      <Navbar />
      <div style={{ padding: "32px 32px", maxWidth: 720, margin: "0 auto" }}>
        <PageHeader
          title="My Session"
          subtitle="Heart rate monitoring real-time"
          right={<ConnectionStatus status={status} />}
        />

        <AlertBanner
          alerts={alerts}
          onDismiss={(id) =>
            setAlerts((prev) => prev.filter((a) => a.id !== id))
          }
        />

        {/* HR Card */}
        <div
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)",
            borderRadius: "var(--radius-xl)",
            padding: "48px 32px",
            textAlign: "center",
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--border-subtle)",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--gray-500)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 8,
            }}
          >
            Heart Rate
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: getHRColor(),
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              transition: "color 0.3s",
              letterSpacing: "-3px",
            }}
          >
            {hr ?? "--"}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--gray-400)",
              marginTop: 4,
              marginBottom: 24,
              fontWeight: 600,
              letterSpacing: "1px",
            }}
          >
            BPM
          </div>
          <HRZoneBadge zone={zone} size="md" />
        </div>

        {/* Session control */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-xs)",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--gray-700)",
                }}
              >
                {activeSessionId
                  ? "Sesi sedang berjalan"
                  : "Belum ada sesi aktif"}
              </div>
              {sessionMsg && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--gray-500)",
                    marginTop: 2,
                  }}
                >
                  {sessionMsg}
                </div>
              )}
            </div>
            {activeSessionId ? (
              <button
                onClick={handleEndSession}
                disabled={sessionBusy}
                style={{
                  padding: "9px 18px",
                  background: sessionBusy
                    ? "var(--gray-300)"
                    : "var(--danger-600)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: sessionBusy ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                {sessionBusy ? "..." : "Akhiri Sesi"}
              </button>
            ) : (
              <button
                onClick={handleStartSession}
                disabled={sessionBusy}
                style={{
                  padding: "9px 18px",
                  background: sessionBusy
                    ? "var(--gray-300)"
                    : "var(--success-600)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: sessionBusy ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                {sessionBusy ? "..." : "Mulai Sesi"}
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              padding: 20,
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--gray-500)",
                fontWeight: 600,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
              }}
            >
              Durasi
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--gray-900)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.5px",
              }}
            >
              {formatDuration(elapsed)}
            </div>
          </div>
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              padding: 20,
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--gray-500)",
                fontWeight: 600,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
              }}
            >
              Zona
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--gray-900)",
                textTransform: "capitalize",
                letterSpacing: "-0.5px",
              }}
            >
              {zone === "unknown" ? "—" : zone.replace("_", " ")}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
