"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Search, Info } from "lucide-react";
import { MonthlyDashboardRow } from "@/types/allTypes";
import ThaiDateInput from "@/app/components/ThaiDateInput";

interface BedOccupancyChartProps {
  months: MonthlyDashboardRow[];
  loading: boolean;
}

// Mock bed occupancy data — replace with real API when available
const MOCK_BED = [
  { name: "ต.ค.", rate: 45 },
  { name: "พ.ย.", rate: 78 },
  { name: "ธ.ค.", rate: 55 },
  { name: "ม.ค.", rate: 62 },
  { name: "ก.พ.", rate: 88 },
  { name: "มี.ค.", rate: 70 },
];

export default function BedOccupancyChart({ months, loading }: BedOccupancyChartProps) {
  const [start, setStart] = useState<Date | null>(new Date(2025, 9, 1));
  const [end, setEnd] = useState<Date | null>(new Date(2026, 8, 30));

  const data = months.length > 0
    ? months.map((m) => ({ name: m.label, rate: Math.min(100, Math.round((m.totalPatient / Math.max(m.totalVisit, 1)) * 100)) }))
    : MOCK_BED;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      {/* Title + filter inside SectionCard style */}
      <h2 className="text-sm font-bold text-gray-600 mb-4">
        อัตราการครองเตียง ปีงบประมาณ 2569 (01-10-2568 ถึง 30-09-2569)
      </h2>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 text-gray-500">
          <Info size={14} />
          <span className="text-xs">เลือกช่วงเวลาที่ต้องการ</span>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <DatePicker
            selected={start}
            onChange={(d: Date | null) => setStart(d)}
            dateFormat="dd/MM/yyyy"
            locale={th}
            showMonthDropdown showYearDropdown dropdownMode="select"
            customInput={<ThaiDateInput />}
          />
          <DatePicker
            selected={end}
            onChange={(d: Date | null) => setEnd(d)}
            dateFormat="dd/MM/yyyy"
            locale={th}
            showMonthDropdown showYearDropdown dropdownMode="select"
            customInput={<ThaiDateInput />}
          />
          <button className="border border-gray-300 rounded-md px-3 py-1 text-xs flex items-center gap-1 hover:bg-gray-50">
            <Search size={12} /> ค้นหา
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        แสดงข้อมูล: <strong className="ml-1 text-gray-700">01 ต.ค. 2568 ถึง 30 มี.ค. 2569</strong>
      </div>

      {loading ? (
        <div className="h-[200px] bg-gray-100 animate-pulse rounded-lg" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#374151" }} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#374151" }} />
            <Tooltip formatter={(v: number) => [`${v}%`, "อัตราครองเตียง"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Bar dataKey="rate" fill="#93c5fd" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}