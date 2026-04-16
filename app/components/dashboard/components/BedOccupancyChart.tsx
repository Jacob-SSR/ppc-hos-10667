"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { useBedOccupancy } from "../hooks/useBedOccupancy";
import { getBedOccupancyColor } from "../constants/dashboard.constants";
import { Shimmer } from "./ui/DashboardUI";
import type { OccupancyRow } from "../types/dashboard.types";

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function OccupancyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as OccupancyRow;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-gray-600">
        Admit:{" "}
        <span className="font-bold text-gray-900">{d.current_admit}</span> /{" "}
        {d.total_beds} เตียง
      </p>
      <p className="text-gray-600">
        อัตราครองเตียง:{" "}
        <span className="font-bold text-gray-900">{d.occupancy_rate}%</span>
      </p>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { color: "#add8e6", label: "ปกติ (<70%)" },
  { color: "#fbbf24", label: "ค่อนข้างเต็ม (70–89%)" },
  { color: "#f87171", label: "เกือบเต็ม (≥90%)" },
];

// ─── Summary Table ────────────────────────────────────────────────────────────

function OccupancyTable({ data }: { data: OccupancyRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {[
              "Ward",
              "เตียงทั้งหมด",
              "Admit ปัจจุบัน",
              "ว่าง",
              "อัตราครองเตียง",
            ].map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-gray-500 font-semibold text-left"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.ward_code}
              className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
            >
              <td className="px-3 py-2 font-medium text-gray-700">
                {row.label}
              </td>
              <td className="px-3 py-2 text-center text-gray-600">
                {row.total_beds}
              </td>
              <td className="px-3 py-2 text-center font-bold text-gray-900">
                {row.current_admit}
              </td>
              <td className="px-3 py-2 text-center text-gray-600">
                {row.total_beds - row.current_admit}
              </td>
              <td className="px-3 py-2 text-center">
                <span
                  className="font-bold"
                  style={{ color: getBedOccupancyColor(row.occupancy_rate) }}
                >
                  {row.occupancy_rate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── BedOccupancyChart ────────────────────────────────────────────────────────

export default function BedOccupancyChart() {
  const { data, loading } = useBedOccupancy();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-base font-bold text-[#717171] mb-4">
        อัตราการครองเตียง ปีงบประมาณ 2569 (01-10-2568 ถึง 30-09-2569)
      </h4>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        {LEGEND_ITEMS.map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm inline-block"
              style={{ background: color }}
            />
            {label}
          </span>
        ))}
      </div>

      {loading ? (
        <Shimmer className="h-[300px]" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 20, left: 0, bottom: 0 }}
            barCategoryGap="28%"
          >
            <CartesianGrid vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 110]}
              ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110]}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <ReferenceLine
              y={100}
              stroke="#ef4444"
              strokeDasharray="4 2"
              strokeWidth={1.5}
            />
            <Tooltip
              content={<OccupancyTooltip />}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar dataKey="occupancy_rate" radius={[3, 3, 0, 0]}>
              {data.map((row, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={getBedOccupancyColor(row.occupancy_rate)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {!loading && data.length > 0 && <OccupancyTable data={data} />}
    </div>
  );
}
