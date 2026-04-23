"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mqtt, { MqttClient, IClientOptions } from "mqtt";

export type MqttStatus = "connected" | "disconnected" | "reconnecting";

interface UseMqttOptions {
  /** Called when a message arrives on a subscribed topic */
  onMessage?: (topic: string, payload: Buffer) => void;
  /** Called once the client is connected */
  onConnect?: () => void;
}

interface UseMqttReturn {
  status: MqttStatus;
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
  publish: (topic: string, message: string) => void;
}

const MQTT_URL = process.env.NEXT_PUBLIC_MQTT_URL ?? "wss://localhost:8084";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Fetch a fresh MQTT token from the API */
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
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mqttToken", data.mqttToken);
      sessionStorage.setItem(
        "mqttTokenExp",
        String(data.expiresAt ?? Date.now() + 30 * 60 * 1000),
      );
    }
    return data.mqttToken as string;
  } catch {
    return null;
  }
}

/** Returns ms until MQTT token expires, or 0 if already expired */
function msUntilMqttExpiry(): number {
  if (typeof window === "undefined") return 0;
  const exp = Number(sessionStorage.getItem("mqttTokenExp") ?? 0);
  return Math.max(0, exp - Date.now());
}

export function useMqtt(options: UseMqttOptions = {}): UseMqttReturn {
  const { onMessage, onConnect } = options;
  const clientRef = useRef<MqttClient | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [status, setStatus] = useState<MqttStatus>("disconnected");
  const subscribedTopics = useRef<Set<string>>(new Set());

  const scheduleTokenRefresh = useCallback(() => {
    if (tokenRefreshTimerRef.current)
      clearTimeout(tokenRefreshTimerRef.current);

    const remaining = msUntilMqttExpiry();
    // Refresh when < 5 minutes (300_000 ms) remain
    const delay = Math.max(0, remaining - 5 * 60 * 1000);

    tokenRefreshTimerRef.current = setTimeout(async () => {
      const newToken = await fetchMqttToken();
      if (newToken && clientRef.current?.connected) {
        // Re-authenticate without disconnecting — EMQX supports AUTH packet
        // For mqtt.js we update the stored token and schedule next refresh
        scheduleTokenRefresh();
      }
    }, delay);
  }, []);

  const connect = useCallback(async () => {
    let token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("mqttToken")
        : null;

    // If token is about to expire, refresh first
    if (!token || msUntilMqttExpiry() < 5 * 60 * 1000) {
      token = await fetchMqttToken();
    }

    const options: IClientOptions = {
      username: token ?? undefined,
      password: token ?? undefined,
      reconnectPeriod: 0, // We handle reconnect manually
      connectTimeout: 10_000,
    };

    const client = mqtt.connect(MQTT_URL, options);
    clientRef.current = client;

    client.on("connect", () => {
      attemptRef.current = 0;
      setStatus("connected");
      scheduleTokenRefresh();

      // Re-subscribe to all tracked topics
      subscribedTopics.current.forEach((topic) => {
        client.subscribe(topic);
      });

      onConnect?.();
    });

    client.on("message", (topic, payload) => {
      onMessage?.(topic, payload);
    });

    client.on("error", (err) => {
      console.error("[useMqtt] error:", err.message);
    });

    client.on("close", () => {
      setStatus("reconnecting");
      scheduleReconnect();
    });

    client.on("offline", () => {
      setStatus("disconnected");
    });
  }, [onConnect, onMessage, scheduleTokenRefresh]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    // Exponential backoff: Math.min(1000 * 2 ** attempt, 60000)
    const delay = Math.min(1000 * Math.pow(2, attemptRef.current), 60_000);
    attemptRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (tokenRefreshTimerRef.current)
        clearTimeout(tokenRefreshTimerRef.current);
      clientRef.current?.end(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscribe = useCallback((topic: string) => {
    subscribedTopics.current.add(topic);
    if (clientRef.current?.connected) {
      clientRef.current.subscribe(topic);
    }
  }, []);

  const unsubscribe = useCallback((topic: string) => {
    subscribedTopics.current.delete(topic);
    if (clientRef.current?.connected) {
      clientRef.current.unsubscribe(topic);
    }
  }, []);

  const publish = useCallback((topic: string, message: string) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish(topic, message);
    }
  }, []);

  return { status, subscribe, unsubscribe, publish };
}
