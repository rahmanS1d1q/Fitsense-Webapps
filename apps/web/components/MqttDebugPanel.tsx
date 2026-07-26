"use client";

import React, { useEffect, useState } from "react";

const MQTT_URL = process.env.NEXT_PUBLIC_MQTT_URL ?? "";
const ENABLED = process.env.NEXT_PUBLIC_ENABLE_MQTT_DEBUG === "true";

interface CopyBtnProps {
  label: string;
  value: string;
}

function CopyBtn({ label, value }: CopyBtnProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "inherit",
        border: "1px solid #334155",
        borderRadius: 6,
        background: copied ? "#065f46" : "#1e293b",
        color: copied ? "#d1fae5" : "#e2e8f0",
        cursor: "pointer",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

export default function MqttDebugPanel() {
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [mqttToken, setMqttToken] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUserId(sessionStorage.getItem("userId") ?? "");
      setCompanyId(sessionStorage.getItem("companyId") ?? "");
      setMqttToken(sessionStorage.getItem("mqttToken") ?? "");
    }
  }, []);

  if (!ENABLED) return null;
  if (!userId && !companyId) return null;

  if (!isOpen) {
    return (
      <div style={{ margin: "24px 0" }}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace',
            letterSpacing: "0.02em",
            border: "1px solid #f59e0b",
            borderRadius: 8,
            background: "linear-gradient(135deg, #1c1917 0%, #292524 100%)",
            color: "#fbbf24",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <span style={{ fontSize: 14 }}>🔧</span>
          Show MQTT Debug
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase" as const,
              color: "#1c1917",
              background: "#f59e0b",
              padding: "2px 6px",
              borderRadius: 3,
            }}
          >
            DEV
          </span>
        </button>
      </div>
    );
  }

  const topic = `fitsense/${companyId}/${userId}/hr`;

  const examplePayload = JSON.stringify(
    {
      hr: 88,
      session_id: "SESSION_ID_FROM_START_SESSION",
      timestamp: Date.now(),
      mac_address: "AA:BB:CC:DD:EE:FF",
    },
    null,
    2,
  );

  const flutterConfig = [
    `MQTT URL: ${MQTT_URL}`,
    `Username: ${userId}`,
    `Password: <mqttToken from login response>`,
    `Company ID: ${companyId}`,
    `Topic: ${topic}`,
    ``,
    `Payload format:`,
    `{`,
    `  "hr": <int 20-300>,`,
    `  "session_id": "<uuid from POST /api/sessions/start>",`,
    `  "timestamp": <unix ms, e.g. Date.now()>,`,
    `  "mac_address": "<optional, e.g. AA:BB:CC:DD:EE:FF>"`,
    `}`,
  ].join("\n");

  return (
    <div
      id="mqtt-debug-panel"
      style={{
        margin: "24px 0",
        padding: 0,
        borderRadius: 12,
        border: "1px solid #f59e0b",
        background: "linear-gradient(135deg, #1c1917 0%, #292524 100%)",
        color: "#e7e5e4",
        fontFamily:
          'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace',
        fontSize: 13,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 20px",
          background:
            "linear-gradient(90deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)",
          borderBottom: "1px solid #44403c",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔧</span>
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "-0.01em",
              color: "#fbbf24",
            }}
          >
            MQTT Debug Panel
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#1c1917",
              background: "#f59e0b",
              padding: "3px 8px",
              borderRadius: 4,
            }}
          >
            DEV ONLY
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
              border: "1px solid #44403c",
              borderRadius: 5,
              background: "transparent",
              color: "#a8a29e",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            ✕ Hide Debug Panel
          </button>
        </div>
      </div>

      {/* Warning */}
      <div
        style={{
          padding: "10px 20px",
          background: "rgba(239, 68, 68, 0.08)",
          borderBottom: "1px solid #44403c",
          color: "#fca5a5",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        ⚠️ DEV ONLY — Do not enable this panel in production.
      </div>

      {/* Body */}
      <div style={{ padding: "16px 20px" }}>
        {/* Connection Info */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 16,
          }}
        >
          <tbody>
            {[
              { label: "MQTT URL", value: MQTT_URL || "(not set)" },
              { label: "Username", value: userId },
              { label: "Company ID", value: companyId },
              { label: "Topic", value: topic },
            ].map((row) => (
              <tr key={row.label}>
                <td
                  style={{
                    padding: "6px 12px 6px 0",
                    color: "#a8a29e",
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                    verticalAlign: "top",
                    width: 110,
                  }}
                >
                  {row.label}
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#e7e5e4",
                    wordBreak: "break-all",
                  }}
                >
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* MQTT Token — hidden by default */}
        <details
          style={{
            marginBottom: 16,
            borderRadius: 8,
            border: "1px solid #44403c",
            overflow: "hidden",
          }}
        >
          <summary
            style={{
              padding: "10px 14px",
              cursor: "pointer",
              background: "rgba(255,255,255,0.03)",
              color: "#a8a29e",
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: "0.02em",
              userSelect: "none",
            }}
          >
            🔑 Show MQTT Token
          </summary>
          <div
            style={{
              padding: "12px 14px",
              borderTop: "1px solid #44403c",
              background: "rgba(0,0,0,0.2)",
              wordBreak: "break-all",
              fontSize: 11,
              lineHeight: 1.6,
              color: "#d6d3d1",
            }}
          >
            {mqttToken || "(empty — token not available)"}
          </div>
        </details>

        {/* Example Payload */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#a8a29e",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 6,
            }}
          >
            Example Payload
          </div>
          <pre
            style={{
              margin: 0,
              padding: "12px 14px",
              background: "rgba(0,0,0,0.3)",
              borderRadius: 8,
              border: "1px solid #44403c",
              fontSize: 12,
              lineHeight: 1.5,
              color: "#a7f3d0",
              overflowX: "auto",
              whiteSpace: "pre",
            }}
          >
            {examplePayload}
          </pre>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <CopyBtn label="📋 Copy MQTT Token" value={mqttToken} />
          <CopyBtn label="📋 Copy Flutter Config" value={flutterConfig} />
          <CopyBtn label="📋 Copy Topic" value={topic} />
          <CopyBtn label="📋 Copy Example Payload" value={examplePayload} />
        </div>
      </div>
    </div>
  );
}
