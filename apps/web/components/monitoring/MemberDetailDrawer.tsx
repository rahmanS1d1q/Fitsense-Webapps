"use client";
import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ZONE_COLORS } from "./HRSparkline";
import type { HRPoint, LiveHR } from "../../hooks/useMonitoringMqtt";
import type { MonitoringMember, MonitoringSession } from "./MemberCard";
import { apiGet, getCompanyId } from "../../lib/api";

interface Props {
  member: MonitoringMember | null;
  session: MonitoringSession | null;
  liveHR: LiveHR | null;
  buffer: HRPoint[];
  onClose: () => void;
}

const MOOD_EMOJI: Record<string, string> = {
  great: "😊",
  good: "🙂",
  neutral: "😐",
  tired: "😴",
  bad: "😣",
};

function moodDisplay(mood: string | null): string {
  if (!mood) return "—";
  return mood
    .split("→")
    .map((m) => `${MOOD_EMOJI[m.trim()] ?? ""} ${m.trim()}`)
    .join(" → ");
}

export default function MemberDetailDrawer({
  member,
  session,
  liveHR,
  buffer,
  onClose,
}: Props) {
  const [histData, setHistData] = useState<HRPoint[]>([]);

  useEffect(() => {
    if (!member) return;
    const companyId = getCompanyId();
    const toIso = new Date().toISOString();
    const fromIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    apiGet(
      `/companies/${companyId}/members/${member.id}/hr?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&interval=10s`,
    )
      .then(({ ok, data }) => {
        if (ok && Array.isArray(data.data)) {
          setHistData(
            data.data.map((d: { time: string; hr: number }) => ({
              t: new Date(d.time).getTime(),
              hr: d.hr,
            })),
          );
        }
      })
      .catch(() => {
        /* live buffer is fallback */
      });
  }, [member]);

  if (!member) return null;

  const name =
    `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() ||
    member.email;
  const zone = liveHR?.hr_zone ?? "unknown";
  const zoneColor = ZONE_COLORS[zone] ?? ZONE_COLORS.unknown;
  const maxHR = member.age ? 220 - member.age : null;
  const chartData = histData.length > 1 ? histData : buffer;

  const durationMin = session
    ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000)
    : 0;
  const hrs = chartData.map((d) => d.hr);
  const avgHr = hrs.length
    ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
    : null;
  const maxHrSeen = hrs.length ? Math.max(...hrs) : null;
  const minHrSeen = hrs.length ? Math.min(...hrs) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.4)",
          zIndex: 1100,
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 100%)",
          background: "#fff",
          zIndex: 1101,
          boxShadow: "-8px 0 32px rgba(0,0,0,0.15)",
          overflowY: "auto",
          animation: "slideInRight 0.25s ease",
        }}
      >
        <div style={{ padding: 24 }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 24,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {name}
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#94a3b8" }}>
                {member.email}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: 8,
                width: 32,
                height: 32,
                cursor: "pointer",
                fontSize: 18,
                color: "#64748b",
              }}
            >
              ×
            </button>
          </div>

          {/* Current HR */}
          <div
            style={{
              background: "#f8fafc",
              borderRadius: 12,
              padding: 20,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: zoneColor,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {liveHR?.hr ?? "--"}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#94a3b8",
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              BPM · {zone.replace("_", " ").toUpperCase()}
            </div>
          </div>

          {/* Chart */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              HR 30 Menit Terakhir
            </div>
            <div
              style={{
                height: 180,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "12px 8px 4px",
              }}
            >
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 4, right: 8, bottom: 4, left: -16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="t"
                      tickFormatter={(t) =>
                        new Date(t).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      }
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                    />
                    <YAxis
                      domain={["dataMin - 10", "dataMax + 10"]}
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                    />
                    <Tooltip
                      labelFormatter={(t) =>
                        new Date(t as number).toLocaleTimeString("id-ID")
                      }
                      formatter={(v) => [`${v} bpm`, "HR"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="hr"
                      stroke={zoneColor}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    color: "#cbd5e1",
                  }}
                >
                  Belum ada data
                </div>
              )}
            </div>
          </div>

          {/* Session stats */}
          {session && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 8,
                }}
              >
                Sesi Saat Ini
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                }}
              >
                {[
                  { label: "Avg HR", value: avgHr ?? "—" },
                  { label: "Max HR", value: maxHrSeen ?? "—" },
                  { label: "Min HR", value: minHrSeen ?? "—" },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: "#f8fafc",
                      borderRadius: 8,
                      padding: "10px 12px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "#475569",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "#94a3b8" }}>Durasi</span>
                  <span style={{ fontWeight: 600 }}>{durationMin} menit</span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "#94a3b8" }}>Mood</span>
                  <span style={{ fontWeight: 600 }}>
                    {moodDisplay(session.mood)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Member info */}
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              Info Member
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#475569",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Usia</span>
                <span style={{ fontWeight: 600 }}>
                  {member.age ?? "—"} tahun
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Max HR</span>
                <span style={{ fontWeight: 600 }}>{maxHR ?? "—"} bpm</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Gender</span>
                <span style={{ fontWeight: 600 }}>
                  {member.gender === "male"
                    ? "Laki-laki"
                    : member.gender === "female"
                      ? "Perempuan"
                      : "—"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Kode Anggota</span>
                <span style={{ fontWeight: 600 }}>
                  {member.bio_code ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
