"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Stethoscope } from "lucide-react";

const PPA_ITEMS = [
  {
    label: "Aging คัดกรองสมอง/หกล้ม (อายุ ≥ 50 ปี)",
    api: "/api/ppa/aging",
    color: "#4ade80",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
  },
  {
    label: "NCD01 คัดกรอง DM/HT",
    api: "/api/ppa/ncd01",
    color: "#60a5fa",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
  },
  {
    label: "MCH01 ฝากครรภ์ (ANC)",
    api: "/api/ppa/mch01",
    color: "#c084fc",
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-800",
  },
  {
    label: "MCH02 คลอด",
    api: "/api/ppa/mch02",
    color: "#fb923c",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-800",
  },
];

export default function PpaOverview() {
  const [counts, setCounts] = useState<number[]>([0, 0, 0, 0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      PPA_ITEMS.map((item) =>
        fetch(item.api, { credentials: "include" })
          .then((r) => r.json())
          .then((d) => (Array.isArray(d) ? d.length : 0))
          .catch(() => 0),
      ),
    )
      .then(setCounts)
      .finally(() => setLoading(false));
  }, []);

  const pieData = PPA_ITEMS.map((item, i) => ({
    name: item.label.split(" ")[0],
    value: counts[i] || 1,
    color: item.color,
  }));

  const RADIAN = Math.PI / 180;
  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    if (percent < 0.05) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Stethoscope size={16} className="text-green-700" />
        <h2 className="text-sm font-bold text-gray-600">
          ภาพรวมผลการดำเนินงาน PPA ปีงบประมาณ 2569
        </h2>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-5">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        แสดงข้อมูล:{" "}
        <strong className="ml-1 text-gray-700">
          01 ธ.ค. 2568 – 31 ก.ค. 2569
        </strong>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Left: stat rows */}
        <div className="space-y-3">
          {PPA_ITEMS.map((item, i) => (
            <div
              key={i}
              className={`${item.bg} border ${item.border} rounded-xl px-4 py-3 flex justify-between items-center`}
            >
              <span
                className={`text-xs font-medium ${item.text} leading-tight max-w-[70%]`}
              >
                {item.label}
              </span>
              {loading ? (
                <div className="w-16 h-5 bg-gray-200 animate-pulse rounded" />
              ) : (
                <span className={`text-base font-bold ${item.text}`}>
                  {counts[i].toLocaleString()} ราย
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Right: pie chart */}
        <div className="flex flex-col items-center">
          {loading ? (
            <div className="w-[220px] h-[220px] rounded-full bg-gray-200 animate-pulse" />
          ) : (
            <ResponsiveContainer width={240} height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number, name: string) => [
                    val.toLocaleString() + " ราย",
                    name,
                  ]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
            {PPA_ITEMS.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: item.color }}
                />
                <span className="text-[11px] text-gray-600">
                  {item.label.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
