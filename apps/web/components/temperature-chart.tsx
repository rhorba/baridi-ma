"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import type { SensorReading } from "@baridi-ma/shared-types";

interface TemperatureChartProps {
  readings: SensorReading[];
  tempMinC: number;
  tempMaxC: number;
}

export function TemperatureChart({ readings, tempMinC, tempMaxC }: TemperatureChartProps) {
  const data = readings.map((r) => ({
    time: new Date(r.time).toLocaleTimeString(),
    temperatureC: r.temperatureC,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} domain={["dataMin - 2", "dataMax + 2"]} />
        <Tooltip />
        <ReferenceLine
          y={tempMinC}
          stroke="var(--color-warning)"
          strokeDasharray="4 4"
          label={{ value: `Min ${tempMinC}°C`, fontSize: 10, position: "insideBottomLeft" }}
        />
        <ReferenceLine
          y={tempMaxC}
          stroke="var(--color-warning)"
          strokeDasharray="4 4"
          label={{ value: `Max ${tempMaxC}°C`, fontSize: 10, position: "insideTopLeft" }}
        />
        <Line type="monotone" dataKey="temperatureC" stroke="var(--color-primary)" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
