import mqtt, { MqttClient } from "mqtt";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MQTT_BROKER_URL = "mqtts://yourdomain.com:8883";
const API_URL = process.env.API_URL ?? "https://yourdomain.com/api";

/** Max 1 data point per second */
const MIN_PUBLISH_INTERVAL_MS = 1000;

/** Refresh MQTT token when < 5 minutes remain */
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Publishes HR data to fitsense/{club_id}/{user_id}/hr.
 * Uses MQTT_Token for auth to broker port 8883.
 * Auto-refreshes MQTT_Token when < 5 minutes remaining.
 * Requirements: 5.2, 5.3, 5.5, 5.6, 5.7
 */
export class MqttPublisher {
  private client: MqttClient | null = null;
  private clubId: string;
  private userId: string;
  private lastPublishTime = 0;
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(clubId: string, userId: string) {
    this.clubId = clubId;
    this.userId = userId;
  }

  async connect(): Promise<void> {
    const token = await this.getValidToken();
    if (!token) throw new Error("No MQTT token available");

    this.client = mqtt.connect(MQTT_BROKER_URL, {
      username: token,
      password: token,
      reconnectPeriod: 5000,
      connectTimeout: 10_000,
    });

    this.client.on("connect", () => {
      this.scheduleTokenRefresh();
    });

    this.client.on("error", (err) => {
      console.error("[MqttPublisher] error:", err.message);
    });
  }

  /**
   * Publish HR data point. Rate-limited to max 1 per second.
   */
  publish(hr: number, sessionId: string, rr?: number): void {
    const now = Date.now();
    if (now - this.lastPublishTime < MIN_PUBLISH_INTERVAL_MS) return;
    if (!this.client?.connected) return;

    const topic = `fitsense/${this.clubId}/${this.userId}/hr`;
    const payload = JSON.stringify({
      hr,
      session_id: sessionId,
      timestamp: now,
      ...(rr !== undefined ? { rr } : {}),
    });

    this.client.publish(topic, payload, { qos: 1 });
    this.lastPublishTime = now;
  }

  private async getValidToken(): Promise<string | null> {
    const [token, expStr] = await AsyncStorage.multiGet([
      "mqttToken",
      "mqttTokenExp",
    ]).then((pairs) => pairs.map(([, v]) => v));

    const exp = Number(expStr ?? 0);
    const remaining = exp - Date.now();

    if (!token || remaining < REFRESH_THRESHOLD_MS) {
      return this.refreshToken();
    }
    return token;
  }

  private async refreshToken(): Promise<string | null> {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      if (!jwt) return null;

      const res = await fetch(`${API_URL}/auth/mqtt-token`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) return null;

      const data = await res.json();
      const newToken: string = data.mqttToken;
      const newExp: number = data.expiresAt ?? Date.now() + 30 * 60 * 1000;

      await AsyncStorage.multiSet([
        ["mqttToken", newToken],
        ["mqttTokenExp", String(newExp)],
      ]);

      return newToken;
    } catch {
      return null;
    }
  }

  private scheduleTokenRefresh(): void {
    if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer);
    if (this.destroyed) return;

    AsyncStorage.getItem("mqttTokenExp").then((expStr) => {
      const exp = Number(expStr ?? 0);
      const remaining = exp - Date.now();
      const delay = Math.max(0, remaining - REFRESH_THRESHOLD_MS);

      this.tokenRefreshTimer = setTimeout(async () => {
        if (this.destroyed) return;
        await this.refreshToken();
        // Schedule next refresh
        this.scheduleTokenRefresh();
      }, delay);
    });
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer);
    this.client?.end(true);
    this.client = null;
  }

  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }
}
