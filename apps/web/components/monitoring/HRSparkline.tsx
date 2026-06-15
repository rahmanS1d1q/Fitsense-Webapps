"use client";
import React from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import type { HRPoint } from "../../hooks/useMonitoringMqtt";

export const ZONE_COLORS: Record<string, string> = {
  rest: "#9ca3af",
  fat_burn: "#2563eb",
  cardio: "#16a34a",
  aerobic: "#d97706",
  peak: "#dc2626",
  unknown: "#9ca3af",
};

interface Props {
  data: HRPoint[];
  zone: string;
}

function HRSparkline({ data, zone }: Props) {
  const color = ZONE_COLORS[zone] ?? ZONE_COLORS.unknown;

  if (data.length < 2) {
    return (
      <div
        style={{
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "#cbd5e1",
        }}
      >
        —
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 60 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 6, right: 2, bottom: 2, left: 2 }}
        >
          <YAxis domain={["dataMin - 5", "dataMax + 5"]} hide />
          <Line
            type="monotone"
            dataKey="hr"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default React.memo(HRSparkline);
