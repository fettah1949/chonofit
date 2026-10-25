"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";

export function SimpleBarChart({
  data,
  seriesLabel,
  currency,
  allowDecimals = false,
}: {
  data: { label: string; value: number }[];
  seriesLabel: string;
  currency?: string;
  allowDecimals?: boolean;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e6e6e6" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5c5c5c" }} axisLine={false} tickLine={false} />
          <YAxis
            allowDecimals={allowDecimals}
            width={48}
            tick={{ fontSize: 12, fill: "#5c5c5c" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(225,6,0,0.08)" }}
            formatter={(value) => {
              const amount = Number(value ?? 0);
              return [currency ? formatMoney(amount, currency) : amount, seriesLabel];
            }}
          />
          <Bar dataKey="value" fill="#e10600" radius={[7, 7, 0, 0]} maxBarSize={42} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
