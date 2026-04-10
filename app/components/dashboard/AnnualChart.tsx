"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { MonthlyDashboardRow } from "@/types/allTypes";

interface AnnualChartProps {
  months: MonthlyDashboardRow[];
  loading: boolean;
}

export default function AnnualChart({ months, loading }: AnnualChartProps) {
  const data = months.map((m) => ({
    name: m.label,
    OPD: m.totalVisit,
    IPD: 0, // IPD จาก monthly API ยังไม่มี ใช้ 0 ไปก่อน
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 text-center mb-4">
        แสดงจำนวนผู้รับบริการ ปีงบประมาณ 2569
      </h2>

      {loading ? (
        <div className="h-[300px] bg-gray-100 animate-pulse rounded-lg" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#374151" }} />
            <YAxis tick={{ fontSize: 11, fill: "#374151" }} />
            <Tooltip
              formatter={(val: number, name: string) => [val.toLocaleString(), name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <Legend
              formatter={(val) => <span style={{ fontSize: 12, color: "#374151" }}>{val}</span>}
            />
            <Bar dataKey="OPD" stackId="a" fill="#2fa4db" radius={[0, 0, 0, 0]} />
            <Bar dataKey="IPD" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}