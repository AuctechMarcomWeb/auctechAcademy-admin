"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/lib/format";

const C = {
  c1: "var(--chart-1)",
  c2: "var(--chart-2)",
  c3: "var(--chart-3)",
  c4: "var(--chart-4)",
  c5: "var(--chart-5)",
};
const PALETTE = [C.c1, C.c3, C.c4, C.c2, C.c5, "#8b5cf6", "#ec4899", "#06b6d4"];

const axisProps = { tick: { fontSize: 11, fill: "#64748b" }, axisLine: false, tickLine: false };
const grid = <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />;

/** Monthly revenue (bars) with enrollments (line) on a second axis. */
export function RevenueChart({ data, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" {...axisProps} />
        <YAxis yAxisId="left" {...axisProps} tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)} width={52} />
        <YAxis yAxisId="right" orientation="right" {...axisProps} allowDecimals={false} width={28} />
        <Tooltip formatter={(v, name) => (name === "Revenue" ? formatINR(Number(v)) : v)} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar animationDuration={500} yAxisId="left" dataKey="value" name="Revenue" fill={C.c1} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Line animationDuration={500} yAxisId="right" type="monotone" dataKey="secondary" name="Enrollments" stroke={C.c3} strokeWidth={2} dot={{ r: 3 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendAreaChart({ data, name, color = C.c1, height = 260, money }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${name}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {grid}
        <XAxis dataKey="label" {...axisProps} />
        <YAxis
          {...axisProps}
          width={money ? 52 : 32}
          tickFormatter={(v) => (money ? (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`) : String(v))}
          allowDecimals={false}
        />
        <Tooltip formatter={(v) => (money ? formatINR(Number(v)) : v)} />
        <Area animationDuration={500} type="monotone" dataKey="value" name={name} stroke={color} strokeWidth={2} fill={`url(#fill-${name})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleLineChart({ data, name, color = C.c1, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={32} allowDecimals={false} />
        <Tooltip />
        <Line animationDuration={500} type="monotone" dataKey="value" name={name} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryBarChart({ data, height = 260, name = "Enrollments", color = C.c1 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" {...axisProps} interval={0} angle={-20} textAnchor="end" height={56} />
        <YAxis {...axisProps} width={32} allowDecimals={false} />
        <Tooltip cursor={{ fill: "rgba(37,99,235,0.06)" }} />
        <Bar animationDuration={500} dataKey="value" name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars, ideal for per-course rates (0–100). */
export function HorizontalBarChart({ data, height, name = "Value", unit = "", color = C.c4, max }) {
  const h = height ?? Math.max(160, data.length * 36 + 24);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" {...axisProps} domain={[0, max ?? "auto"]} tickFormatter={(v) => `${v}${unit}`} />
        <YAxis type="category" dataKey="label" {...axisProps} width={150} tickFormatter={(v) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
        <Tooltip formatter={(v) => `${v}${unit}`} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
        <Bar animationDuration={500} dataKey="value" name={name} fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie animationDuration={500} data={data} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="#fff">
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
