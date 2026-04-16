"use client";

import { useEffect, useState } from "react";
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
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Search, Info } from "lucide-react";
import ThaiDateInput from "@/app/components/ThaiDateInput";

interface OccupancyRow {
  ward_code: string;
  label: string;
  total_beds: number;
  current_admit: number;
  occupancy_rate: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload?.length) {
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
  return null;
}

// สีแท่งตามอัตราครองเตียง
function getBarColor(rate: number) {
  if (rate >= 90) return "#f87171"; // แดง — เกือบเต็ม
  if (rate >= 70) return "#fbbf24"; // เหลือง — ค่อนข้างเต็ม
  return "#add8e6"; // ฟ้าอ่อน — ปกติ
}

interface BedOccupancyChartProps {
  loading?: boolean;
}

export default function BedOccupancyChart({
  loading: parentLoading,
}: BedOccupancyChartProps) {
  const [data, setData] = useState<OccupancyRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [start, setStart] = useState<Date | null>(new Date(2025, 9, 1));
  const [end, setEnd] = useState<Date | null>(new Date(2026, 8, 30));

  const fetchData = async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/ipd/bed-occupancy", {
        credentials: "include",
      });
      if (res.ok) setData(await res.json());
    } catch {}
    setFetching(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isLoading = parentLoading || fetching;

  // คำนวณ date range label
  const today = new Date();
  const [y, m, d] = [
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  ];
  const thaiToday = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
  const fiscalStart = m >= 10 ? `01/10/${y + 543}` : `01/10/${y + 542}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-base font-bold text-[#717171] mb-3">
        อัตราการครองเตียง ปีงบประมาณ 2569 (01-10-2568 ถึง 30-09-2569)
      </h4>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="flex items-center gap-2 text-[#717171]">
          <Info size={14} />
          <div>
            <p className="text-sm">ข้อมูลตามช่วงเวลา (สำหรับ การ์ด)</p>
            <p className="text-xs text-gray-400">เลือกช่วงเวลาที่ต้องการ</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <select className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white">
            <option>วันนี้</option>
            <option>เดือนนี้</option>
            <option>ปีงบประมาณ</option>
          </select>
          <DatePicker
            selected={start}
            onChange={(d: Date | null) => setStart(d)}
            dateFormat="dd/MM/yyyy"
            locale={th}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            customInput={<ThaiDateInput />}
          />
          <DatePicker
            selected={end}
            onChange={(d: Date | null) => setEnd(d)}
            dateFormat="dd/MM/yyyy"
            locale={th}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            customInput={<ThaiDateInput />}
          />
          <button
            onClick={fetchData}
            className="border border-gray-300 rounded px-3 py-1.5 flex items-center gap-1.5 text-sm hover:bg-gray-50 text-gray-600"
          >
            <Search size={14} /> ค้นหา
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-[#717171] mb-5">
        <Info size={14} />
        <span>
          แสดงข้อมูล ณ วันนี้ ({thaiToday}) — admit ปัจจุบัน / จำนวนเตียงทั้งหมด
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm inline-block"
            style={{ background: "#add8e6" }}
          />{" "}
          ปกติ (&lt;70%)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm inline-block"
            style={{ background: "#fbbf24" }}
          />{" "}
          ค่อนข้างเต็ม (70–89%)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm inline-block"
            style={{ background: "#f87171" }}
          />{" "}
          เกือบเต็ม (≥90%)
        </span>
      </div>

      {isLoading ? (
        <div className="h-[300px] bg-gray-100 animate-pulse rounded-lg" />
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
            {/* เส้น 100% */}
            <ReferenceLine
              y={100}
              stroke="#ef4444"
              strokeDasharray="4 2"
              strokeWidth={1.5}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar dataKey="occupancy_rate" radius={[3, 3, 0, 0]}>
              {data.map((row, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={getBarColor(row.occupancy_rate)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Table สรุป */}
      {!isLoading && data.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-gray-500 font-semibold">
                  Ward
                </th>
                <th className="px-3 py-2 text-center text-gray-500 font-semibold">
                  เตียงทั้งหมด
                </th>
                <th className="px-3 py-2 text-center text-gray-500 font-semibold">
                  Admit ปัจจุบัน
                </th>
                <th className="px-3 py-2 text-center text-gray-500 font-semibold">
                  ว่าง
                </th>
                <th className="px-3 py-2 text-center text-gray-500 font-semibold">
                  อัตราครองเตียง
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={i}
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
                      style={{ color: getBarColor(row.occupancy_rate) }}
                    >
                      {row.occupancy_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
