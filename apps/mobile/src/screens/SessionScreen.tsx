import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Vibration,
  Platform,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import mqtt, { MqttClient } from "mqtt";

type HRZone = "rest" | "fat_burn" | "cardio" | "aerobic" | "peak" | "unknown";

const ZONE_COLORS: Record<HRZone, string> = {
  rest: "#0369a1",
  fat_burn: "#15803d",
  cardio: "#a16207",
  aerobic: "#c2410c",
  peak: "#b91c1c",
  unknown: "#6b7280",
};

const ZONE_LABELS: Record<HRZone, string> = {
  rest: "Rest",
  fat_burn: "Fat Burn",
  cardio: "Cardio",
  aerobic: "Aerobic",
  peak: "Peak",
  unknown: "Unknown",
};

const MQTT_BROKER_URL = "mqtts://yourdomain.com:8883";

interface SessionScreenProps {
  sessionId: string;
  clubId: string;
  userId: string;
  currentHR: number | null;
  onEndSession: () => void;
}

/**
 * Session screen — shows HR, zone, session duration, and alert notifications.
 * Updates in < 1 second. Subscribes to alerts topic with haptic feedback.
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */
export default function SessionScreen({
  sessionId,
  clubId,
  userId,
  currentHR,
  onEndSession,
}: SessionScreenProps) {
  const [hr, setHr] = useState<number | null>(currentHR);
  const [zone, setZone] = useState<HRZone>("unknown");
  const [elapsed, setElapsed] = useState(0);
  const sessionStartRef = useRef(Date.now());
  const mqttClientRef = useRef<MqttClient | null>(null);

  // Update elapsed time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync HR from parent prop
  useEffect(() => {
    if (currentHR !== null) setHr(currentHR);
  }, [currentHR]);

  // Subscribe to own alerts topic via MQTT
  useEffect(() => {
    let client: MqttClient;

    AsyncStorage.getItem("mqttToken").then((token) => {
      if (!token) return;

      client = mqtt.connect(MQTT_BROKER_URL, {
        username: token,
        password: token,
        reconnectPeriod: 5000,
      });

      client.on("connect", () => {
        // Subscribe to own HR (for server-confirmed data) and alerts
        client.subscribe(`fitsense/${clubId}/${userId}/hr`);
        client.subscribe(`fitsense/${clubId}/${userId}/alerts`);
      });

      client.on("message", (topic, payload) => {
        const parts = topic.split("/");
        const type = parts[3];

        try {
          const data = JSON.parse(payload.toString());

          if (type === "hr") {
            setHr(data.hr as number);
            setZone((data.hr_zone ?? "unknown") as HRZone);
          }

          if (type === "alerts") {
            triggerAlert(
              data.alert_type as string,
              data.alert_message as string,
            );
          }
        } catch {
          // Ignore malformed messages
        }
      });

      mqttClientRef.current = client;
    });

    return () => {
      mqttClientRef.current?.end(true);
    };
  }, [clubId, userId]);

  const triggerAlert = (type: string, message: string) => {
    // Haptic feedback
    if (type === "CRITICAL") {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    } else {
      Vibration.vibrate([0, 300, 100, 300]);
    }

    // Alert notification
    Alert.alert(type === "CRITICAL" ? "⚠️ CRITICAL" : "⚠️ WARNING", message, [
      { text: "OK" },
    ]);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const zoneColor = ZONE_COLORS[zone];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sesi Latihan</Text>

      {/* HR Display */}
      <View style={[styles.hrCard, { borderColor: zoneColor }]}>
        <Text style={[styles.hrValue, { color: zoneColor }]}>{hr ?? "--"}</Text>
        <Text style={styles.hrUnit}>bpm</Text>
        <View style={[styles.zoneBadge, { backgroundColor: zoneColor }]}>
          <Text style={styles.zoneLabel}>{ZONE_LABELS[zone]}</Text>
        </View>
      </View>

      {/* Session Duration */}
      <View style={styles.durationCard}>
        <Text style={styles.durationLabel}>Durasi Sesi</Text>
        <Text style={styles.durationValue}>{formatDuration(elapsed)}</Text>
      </View>

      {/* End Session Button */}
      <View style={styles.endButton}>
        <Text style={styles.endButtonText} onPress={onEndSession}>
          Akhiri Sesi
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 32,
    color: "#111827",
  },
  hrCard: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    backgroundColor: "#f9fafb",
  },
  hrValue: {
    fontSize: 64,
    fontWeight: "800",
    lineHeight: 72,
  },
  hrUnit: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 8,
  },
  zoneBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  zoneLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  durationCard: {
    alignItems: "center",
    marginBottom: 40,
  },
  durationLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  durationValue: {
    fontSize: 40,
    fontWeight: "600",
    color: "#111827",
  },
  endButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  endButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
