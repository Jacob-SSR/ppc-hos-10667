"use client";

import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Info,
  Search,
} from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { useIpdData } from "@/app/components/dashboard/hooks/useIpdData";
import type { WardDisplayItem } from "@/app/components/dashboard/types/dashboard.types";
import { Shimmer } from "./ui/DashboardUI";

function WardCard({ ward }: { ward: WardDisplayItem }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 shadow-sm">
      <p className="text-sm font-semibold text-gray-700 text-center">
        {ward.label}
      </p>
      <BedDouble size={52} strokeWidth={1.5} className="text-gray-800 my-1" />
      <p className="text-base font-bold text-gray-900 text-center">
        Admit {ward.admit}/{ward.totalBeds} เตียง
      </p>
      <p className="text-xs text-gray-500">({ward.vacantLabel})</p>
      <button className="flex items-center gap-1.5 border border-gray-300 rounded-full px-4 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors mt-1">
        รายละเอียด <ArrowRight size={12} />
      </button>
    </div>
  );
}

export default function IpdSection() {
  const {
    displayWards,
    loading,
    date,
    setDate,
    handleSearch,
    infoLabel,
  } = useIpdData();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-lg font-bold text-[#717171] mb-3">
        ภาพรวมผู้รับบริการ IPD วันนี้
      </h4>

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
            onChange={(d: Date | null) => {
              if (d) setDate(d);
            }}
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

      <div className="flex items-center gap-2 text-sm text-[#717171] mb-4">
        <Info size={14} />
        <span>
          แสดงข้อมูล การ์ด:{" "}
          <span className="font-bold">{infoLabel || "—"}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
            <Shimmer key={i} className="h-[190px]" />
          ))
          : displayWards.map((ward) => (
            <WardCard key={ward.ward_code} ward={ward} />
          ))}
      </div>
    </div>
  );
}