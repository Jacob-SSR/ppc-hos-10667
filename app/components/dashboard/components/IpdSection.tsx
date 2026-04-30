// app/components/dashboard/components/IpdSection.tsx
"use client";

import { Search, CalendarDays, Info } from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { WardCard } from "./WardCard";
import { Shimmer } from "@/app/components/ui/Shimmer";
import { useIpdData } from "@/app/components/dashboard/hooks/useIpdData";

export default function IpdSection() {
  const { displayWards, loading, date, setDate, handleSearch, infoLabel } =
    useIpdData();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-lg font-bold text-[#717171] mb-3">
        ภาพรวมผู้รับบริการ IPD วันนี้
      </h4>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="flex items-center gap-2 text-[#717171]">
          <CalendarDays size={16} />
          <div>
            <p className="text-sm">ข้อมูลตามวันที่ (สำหรับ การ์ด)</p>
            <p className="text-xs text-gray-400">เลือกวันที่ต้องการ</p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <DatePicker
            selected={date}
            onChange={(d: Date | null) => { if (d) setDate(d); }}
            dateFormat="dd/MM/yyyy"
            locale={th}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            customInput={<ThaiDateInput />}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="border border-gray-300 rounded px-3 py-1.5 flex items-center gap-1.5 text-sm hover:bg-gray-50 text-gray-600 disabled:opacity-50"
          >
            {loading ? (
              <span className="w-3 h-3 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin inline-block" />
            ) : (
              <Search size={14} />
            )}
            ค้นหา
          </button>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center gap-2 text-sm text-[#717171] mb-4">
        <Info size={14} />
        <span>
          แสดงข้อมูล การ์ด:{" "}
          <span className="font-bold">{infoLabel || "—"}</span>
        </span>
      </div>

      {/* Ward cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
            <Shimmer key={i} h="h-[190px]" />
          ))
          : displayWards.map((ward) => (
            <WardCard key={ward.ward_code} ward={ward} />
          ))}
      </div>
    </div>
  );
}