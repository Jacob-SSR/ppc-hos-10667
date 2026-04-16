"use client";

import { ArrowRight, BedDouble, CalendarDays, Info } from "lucide-react";
import { DateRangeToolbar, Shimmer } from "./ui/DashboardUI";
import { useIpdData } from "@/app/components/dashboard/hooks/useIpdData";

import type { WardDisplayItem } from "@/app/components/dashboard/types/dashboard.types";
import { toThaiDate } from "./utils/dashboard.utils";

// ─── Ward Card ────────────────────────────────────────────────────────────────

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

// ─── IpdSection ───────────────────────────────────────────────────────────────

interface IpdSectionProps {
  /** วันที่วันนี้ในรูปแบบ YYYY-MM-DD */
  dateLabel: string;
}

export default function IpdSection({ dateLabel }: IpdSectionProps) {
  const { displayWards, loading, start, end, setStart, setEnd, refetch } =
    useIpdData();

  const thaiDate = dateLabel ? toThaiDate(dateLabel) : "";

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-lg font-bold text-[#717171] mb-3">
        ภาพรวมผู้รับบริการ IPD วันนี้
      </h4>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="flex items-center gap-2 text-[#717171]">
          <CalendarDays size={16} />
          <div>
            <p className="text-sm">ข้อมูลตามช่วงเวลา (สำหรับ การ์ด)</p>
            <p className="text-xs text-gray-400">เลือกช่วงเวลาที่ต้องการ</p>
          </div>
        </div>
        <div className="ml-auto">
          <DateRangeToolbar
            start={start}
            end={end}
            onStartChange={(d) => d && setStart(d)}
            onEndChange={(d) => d && setEnd(d)}
            onSearch={refetch}
            loading={loading}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-[#717171] mb-4">
        <Info size={14} />
        <span>
          แสดงข้อมูล การ์ด:{" "}
          <span className="font-bold">วันนี้ ({thaiDate})</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <Shimmer key={i} className="h-[190px]" />
            ))
          : displayWards.map((ward) => (
              <WardCard key={ward.ward_code} ward={ward} />
            ))}
      </div>
    </div>
  );
}
