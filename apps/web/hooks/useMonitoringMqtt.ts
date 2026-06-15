"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mqtt, { MqttClient, IClientOptions } from "mqtt";

export type MqttStatus = "connected" | "disconnected" | "reconnecting";
export type AlertType = "CRITICAL" | "WARNING";

export interface LiveHR {
  hr: number;
  rr?: number;
  hr_zone: string;
  session_id?: string;
  timestamp: number;
}

export interface HRPoint {
  t: number;
  hr: number;
}

export interface MemberAlert {
  userId: string;
  type: AlertType;
  message: string;
  hr?: number;
  timestamp: number;
}

interface UseMonitoringMqttReturn {
  liveHRMap: Map<string, LiveHR>;
  hrBufferMap: Map<string, HRPoint[]>;
  alertMap: Map<string, MemberAlert>;
  connectionStatus: MqttStatus;
  activeAlerts: MemberAlert[];
  dismissAlert: (userId: string) => void;
  version: number; // bump to trigger re-render
}

const MQTT_URL = process.env.NEXT_PUBLIC_MQTT_URL ?? "ws://localhost:8083";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const BUFFER_SIZE = 60;

async function fetchMqttToken(): Promise<string | null> {
  try {
    const jwt =
      typeof window !== "undefined" ? sessionStorage.getItem("jwt") : null;
    if (!jwt) return null;
    const res = await fetch(`${API_URL}/auth/mqtt-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const token: string = data.mqttToken;
    let expMs = Date.now() + 30 * 60 * 1000;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp) expMs = payload.exp * 1000;
    } catch {
      /* */
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mqttToken", token);
      sessionStorage.setItem("mqttTokenExp", String(expMs));
    }
    return token;
  } catch {
    return null;
  }
}

function msUntilExpiry(): number {
  if (typeof window === "undefined") return 0;
  const exp = Number(sessionStorage.getItem("mqttTokenExp") ?? 0);
  return Math.max(0, exp - Date.now());
}

export function useMonitoringMqtt(): UseMonitoringMqttReturn {
  const companyId =
    typeof window !== "undefined"
      ? (sessionStorage.getItem("companyId") ?? "")
      : "";

  const clientRef = useRef<MqttClient | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Data stored in refs (avoids re-render on every message), version bump triggers render
  const liveHRMap = useRef<Map<string, LiveHR>>(new Map());
  const hrBufferMap = useRef<Map<string, HRPoint[]>>(new Map());
  const alertMap = useRef<Map<string, MemberAlert>>(new Map());
  const dismissedRef = useRef<Set<string>>(new Set());

  const [connectionStatus, setConnectionStatus] =
    useState<MqttStatus>("disconnected");
  const [version, setVersion] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState<MemberAlert[]>([]);

  const bumpThrottle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bump = useCallback(() => {
    if (bumpThrottle.current) return;
    bumpThrottle.current = setTimeout(() => {
      bumpThrottle.current = null;
      setVersion((v) => v + 1);
    }, 250); // throttle re-render to 4fps for the grid
  }, []);

  const dismissAlert = useCallback((userId: string) => {
    dismissedRef.current.add(userId);
    alertMap.current.delete(userId);
    setActiveAlerts((prev) => prev.filter((a) => a.userId !== userId));
    setVersion((v) => v + 1);
  }, []);

  const handleMessage = useCallback(
    (topic: string, payload: Buffer) => {
      const parts = topic.split("/");
      // fitsense/{company_id}/{user_id}/hr | alerts
      if (parts.length < 4) return;
      const userId = parts[2];
      const kind = parts[3];

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(payload.toString());
      } catch {
        return;
      }

      if (kind === "hr") {
        const hr = Number(data.hr);
        const ts = Number(data.timestamp) || Date.now();
        liveHRMap.current.set(userId, {
          hr,
          rr: data.rr as number | undefined,
          hr_zone: (data.hr_zone as string) ?? "unknown",
          session_id: data.session_id as string | undefined,
          timestamp: ts,
        });
        const buf = hrBufferMap.current.get(userId) ?? [];
        buf.push({ t: ts, hr });
        while (buf.length > BUFFER_SIZE) buf.shift();
        hrBufferMap.current.set(userId, buf);
        bump();
      }

      if (kind === "alerts") {
        const type = (data.alert_type as AlertType) ?? "WARNING";
        const alert: MemberAlert = {
          userId,
          type,
          message: (data.alert_message as string) ?? "Anomali terdeteksi",
          hr: data.hr as number | undefined,
          timestamp: Date.now(),
        };
        alertMap.current.set(userId, alert);
        dismissedRef.current.delete(userId);
        setActiveAlerts((prev) => {
          const filtered = prev.filter((a) => a.userId !== userId);
          return [alert, ...filtered].slice(0, 3);
        });
        setVersion((v) => v + 1);
      }
    },
    [bump],
  );

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    const delay = Math.min(1000 * 2 ** attemptRef.current, 60000);
    attemptRef.current += 1;
    reconnectTimer.current = setTimeout(() => {
      connect();
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleTokenRefresh = useCallback(() => {
    if (tokenTimer.current) clearTimeout(tokenTimer.current);
    const remaining = msUntilExpiry();
    const delay = Math.max(0, remaining - 5 * 60 * 1000);
    tokenTimer.current = setTimeout(async () => {
      await fetchMqttToken();
      scheduleTokenRefresh();
    }, delay);
  }, []);

  const connect = useCallback(async () => {
    let token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("mqttToken")
        : null;
    if (!token || msUntilExpiry() < 5 * 60 * 1000)
      token = await fetchMqttToken();

    const options: IClientOptions = {
      username: token ?? undefined,
      password: token ?? undefined,
      reconnectPeriod: 0,
      connectTimeout: 10000,
    };

    const client = mqtt.connect(MQTT_URL, options);
    clientRef.current = client;

    client.on("connect", () => {
      attemptRef.current = 0;
      setConnectionStatus("connected");
      scheduleTokenRefresh();
      if (companyId) client.subscribe(`fitsense/${companyId}/#`);
    });
    client.on("message", handleMessage);
    client.on("error", (err) =>
      console.error("[monitoring mqtt]", err.message),
    );
    client.on("close", () => {
      setConnectionStatus("reconnecting");
      scheduleReconnect();
    });
    client.on("offline", () => setConnectionStatus("disconnected"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, handleMessage, scheduleReconnect, scheduleTokenRefresh]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (tokenTimer.current) clearTimeout(tokenTimer.current);
      if (bumpThrottle.current) clearTimeout(bumpThrottle.current);
      clientRef.current?.end(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    liveHRMap: liveHRMap.current,
    hrBufferMap: hrBufferMap.current,
    alertMap: alertMap.current,
    connectionStatus,
    activeAlerts,
    dismissAlert,
    version,
  };
}
