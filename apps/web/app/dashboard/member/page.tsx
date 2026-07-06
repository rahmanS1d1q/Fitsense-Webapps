"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useMqtt } from "../../../hooks/useMqtt";
import HRZoneBadge, { HRZone } from "../../../components/HRZoneBadge";
import AlertBanner, { Alert } from "../../../components/AlertBanner";
import ConnectionStatus from "../../../components/ConnectionStatus";
import Navbar from "../../../components/Navbar";
import PageHeader from "../../../components/PageHeader";
import {
  PageContainer,
  PageSection,
  Card,
} from "../../../components/layout/PageContainer";
import { apiGet, apiPost } from "../../../lib/api";
import BiometricConfirmDialog from "../../../components/sessions/BiometricConfirmDialog";

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

  // Biometric & Device states
  const [profile, setProfile] = useState<{ weight?: number; height?: number } | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [weightInput, setWeightInput] = useState<string>("");
  const [heightInput, setHeightInput] = useState<string>("");
  const [moodInput, setMoodInput] = useState<string>("");
  
  const [showStartForm, setShowStartForm] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [biometricChanges, setBiometricChanges] = useState<any>(null);

  useEffect(() => {
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - sessionStart) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [sessionStart]);

  // Fetch profile and devices
  useEffect(() => {
    if (companyId && userId) {
      apiGet(`/companies/${companyId}/members/${userId}`).then(({ ok, data }) => {
        if (ok && data.member) {
          setProfile(data.member);
          setWeightInput(data.member.weight ? String(data.member.weight) : "");
          setHeightInput(data.member.height ? String(data.member.height) : "");
        }
      });
      apiGet(`/companies/${companyId}/members/${userId}/devices`).then(({ ok, data }) => {
        if (ok && data.devices) {
          setDevices(data.devices);
          const defaultDev = data.devices.find((d: any) => d.is_default);
          if (defaultDev) {
            setSelectedDeviceId(defaultDev.id);
          } else if (data.devices.length > 0) {
            setSelectedDeviceId(data.devices[0].id);
          }
        }
      });
    }
  }, [companyId, userId]);

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

  // Initial check when user clicks "Mulai Sesi" inside the form
  const handlePreStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionBusy(true);
    setSessionMsg("");

    const weightNum = weightInput ? Number(weightInput) : undefined;
    const heightNum = heightInput ? Number(heightInput) : undefined;

    // Call check-biometric API
    const { ok, data } = await apiPost(`/companies/${companyId}/sessions/check-biometric`, {
      user_id: userId,
      weight: weightNum ?? 0,
      height: heightNum ?? 0,
    });

    setSessionBusy(false);

    if (ok && data.has_changes) {
      setBiometricChanges(data.changes);
      setIsConfirmOpen(true);
    } else {
      // No changes, start session directly
      await executeStartSession(false);
    }
  };

  // Actual session start call
  const executeStartSession = async (updateProfile: boolean) => {
    setIsConfirmOpen(false);
    setSessionBusy(true);
    setSessionMsg("Memulai sesi...");

    const weightNum = weightInput ? Number(weightInput) : undefined;
    const heightNum = heightInput ? Number(heightInput) : undefined;

    const { ok, status: code, data } = await apiPost(`/companies/${companyId}/sessions/start-with-biometric`, {
      workout_id: undefined, // or attach if workout selected
      mood: moodInput || undefined,
      weight: weightNum,
      height: heightNum,
      update_profile: updateProfile,
      device_id: selectedDeviceId || undefined,
    });

    setSessionBusy(false);
    if (ok) {
      setActiveSessionId(data.session?.id ?? null);
      setSessionMsg("Sesi dimulai. Mulai kirim data HR dari sensor.");
      setShowStartForm(false);
    } else if (code === 409) {
      setActiveSessionId(data.activeSessionId ?? null);
      setSessionMsg("Sesi aktif sudah ada.");
      setShowStartForm(false);
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
      <PageContainer maxWidth="5xl">
        <PageHeader
          title="My Session"
          subtitle="Heart rate monitoring real-time"
          right={<ConnectionStatus status={status} />}
        />

        <PageSection>
          <AlertBanner
            alerts={alerts}
            onDismiss={(id) =>
              setAlerts((prev) => prev.filter((a) => a.id !== id))
            }
          />
        </PageSection>

        <PageSection>
          {/* HR Card */}
          <div
            className="card card-highlight card-elevated mb-4"
            style={{
              textAlign: "center",
              padding: "48px 32px",
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
          <Card className="mb-4">
            {!showStartForm ? (
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
                    onClick={() => setShowStartForm(true)}
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
            ) : (
              // Start Session Form
              <form onSubmit={handlePreStartSession} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--gray-900)" }}>
                  Persiapan Sesi Latihan
                </h4>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--gray-700)", marginBottom: "4px" }}>
                      Berat Badan (kg)
                    </label>
                    <input
                      type="number"
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      placeholder="e.g. 70"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid var(--gray-300)",
                        borderRadius: "6px",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--gray-700)", marginBottom: "4px" }}>
                      Tinggi Badan (cm)
                    </label>
                    <input
                      type="number"
                      value={heightInput}
                      onChange={(e) => setHeightInput(e.target.value)}
                      placeholder="e.g. 170"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid var(--gray-300)",
                        borderRadius: "6px",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--gray-700)", marginBottom: "4px" }}>
                    Mood
                  </label>
                  <input
                    type="text"
                    value={moodInput}
                    onChange={(e) => setMoodInput(e.target.value)}
                    placeholder="e.g. Bersemangat, Lelah"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--gray-300)",
                      borderRadius: "6px",
                      fontSize: "14px",
                    }}
                  />
                </div>

                {/* Device Selection (Shown only if member has > 1 device) */}
                {devices.length > 1 && (
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--gray-700)", marginBottom: "4px" }}>
                      Pilih Sensor/Device
                    </label>
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid var(--gray-300)",
                        borderRadius: "6px",
                        fontSize: "14px",
                        backgroundColor: "#fff",
                      }}
                    >
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name || d.mac_address} {d.is_default ? "(Default)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setShowStartForm(false)}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "transparent",
                      border: "1px solid var(--gray-300)",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--gray-700)",
                      cursor: "pointer",
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={sessionBusy}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "var(--success-600)",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#fff",
                      cursor: sessionBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    {sessionBusy ? "Mengecek..." : "Konfirmasi Mulai Sesi"}
                  </button>
                </div>
              </form>
            )}
          </Card>

          {/* Stats Grid */}
          <div className="stats-grid">
            <Card>
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
            </Card>
            <Card>
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
            </Card>
          </div>
        </PageSection>
      </PageContainer>

      <BiometricConfirmDialog
        isOpen={isConfirmOpen}
        changes={biometricChanges}
        onConfirm={executeStartSession}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}

