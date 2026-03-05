"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

export type RiskByPhaseRow = {
  name: string;
  high: number;
  medium: number;
  low: number;
};

const RISK_COLORS = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#059669",
};

export function RiskByPhaseStackedBar({ rows }: { rows: RiskByPhaseRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
        No hay datos por fase.
      </div>
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fontSize: 11 }}
            stroke="#64748b"
          />
          <Tooltip
            contentStyle={{
              fontSize: "12px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
            formatter={(value: number | undefined) => [value ?? 0, ""]}
            labelFormatter={(label) => label}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px" }}
            formatter={(value) =>
              value === "high" ? "Alto" : value === "medium" ? "Medio" : "Bajo"
            }
          />
          <Bar dataKey="high" stackId="risk" fill={RISK_COLORS.high} name="high" radius={[0, 0, 0, 0]} />
          <Bar dataKey="medium" stackId="risk" fill={RISK_COLORS.medium} name="medium" radius={[0, 0, 0, 0]} />
          <Bar dataKey="low" stackId="risk" fill={RISK_COLORS.low} name="low" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
