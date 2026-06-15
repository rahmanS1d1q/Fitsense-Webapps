"use client";
import React, { useEffect, useRef } from "react";
import type { MemberAlert } from "../../hooks/useMonitoringMqtt";

interface Props {
  alerts: MemberAlert[];
  nameOf: (userId: string) => string;
  onDismiss: (userId: string) => void;
}

// Web Audio beep for CRITICAL alerts
function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* audio not available */
  }
}

export default function AlertBanner({ alerts, nameOf, onDismiss }: Props) {
  const seenCritical = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    alerts.forEach((a) => {
      // Beep on new CRITICAL
      if (
        a.type === "CRITICAL" &&
        !seenCritical.current.has(a.userId + a.timestamp)
      ) {
        seenCritical.current.add(a.userId + a.timestamp);
        playBeep();
      }
      // Auto-dismiss after 10s
      const key = a.userId + a.timestamp;
      if (!timers.current.has(key)) {
        const t = setTimeout(() => {
          onDismiss(a.userId);
          timers.current.delete(key);
        }, 10000);
        timers.current.set(key, t);
      }
    });
  }, [alerts, onDismiss]);

  if (alerts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "min(560px, calc(100% - 32px))",
      }}
    >
      {alerts.map((a) => {
        const critical = a.type === "CRITICAL";
        return (
          <div
            key={a.userId + a.timestamp}
            className="animate-slideIn"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderRadius: 10,
              background: critical ? "#dc2626" : "#fbbf24",
              color: critical ? "#fff" : "#1c1917",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>{critical ? "🚨" : "⚠️"}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {a.type} — {nameOf(a.userId)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  {a.message}
                  {a.hr ? ` (${a.hr} bpm)` : ""}
                </div>
              </div>
            </div>
            <button
              onClick={() => onDismiss(a.userId)}
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                fontSize: 18,
                padding: "0 4px",
                opacity: 0.8,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
