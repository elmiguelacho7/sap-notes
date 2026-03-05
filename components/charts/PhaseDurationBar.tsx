"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export type PhaseDurationRow = {
  name: string;
  days: number;
};

const BAR_FILL = "#6366f1";

export function PhaseDurationBar({ rows }: { rows: PhaseDurationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
        No hay fases con fechas.
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
            formatter={(value: number | undefined) => [`${value ?? 0} días`, "Duración"]}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="days" fill={BAR_FILL} name="days" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
