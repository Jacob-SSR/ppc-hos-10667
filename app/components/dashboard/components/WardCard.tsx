// app/components/dashboard/components/WardCard.tsx
"use client";

import { useState } from "react";
import type { WardDisplayItem } from "@/app/components/dashboard/types/dashboard.types";
import WardDetailModal from "./WardDetailModal";

interface WardCardProps {
  ward: WardDisplayItem;
  date: string;
}

function occupancyStyle(rate: number) {
  if (rate === 0) return { fill: "#B4B2A9", badgeBg: "#F1EFE8", badgeText: "#5F5E5A" };
  if (rate >= 90) return { fill: "#E24B4A", badgeBg: "#FCEBEB", badgeText: "#A32D2D" };
  if (rate >= 70) return { fill: "#EF9F27", badgeBg: "#FAEEDA", badgeText: "#854F0B" };
  return { fill: "#639922", badgeBg: "#EAF3DE", badgeText: "#3B6D11" };
}

export function WardCard({ ward, date }: WardCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const rate = ward.totalBeds > 0 ? Math.round((ward.admit / ward.totalBeds) * 100) : 0;
  const vacant = ward.totalBeds - ward.admit;
  const s = occupancyStyle(rate);

  return (
    <>
      <div
        className="bg-white border border-gray-200 rounded-xl p-3.5 flex flex-col gap-2 hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
        style={{ borderWidth: "0.5px" }}
      >
        {/* Ward name */}
        <p className="text-[11px] font-medium text-gray-500 tracking-wide truncate">
          {ward.label}
        </p>

        {/* ว่าง (ตัวหลัก) */}
        <div className="flex items-baseline gap-1">
          <span className="text-[26px] font-medium leading-none tabular-nums"
            style={{ color: vacant === 0 ? "#E24B4A" : "#111827" }}>
            {vacant}
          </span>
          <span className="text-[13px] text-gray-400">ว่าง</span>
        </div>

        {/* Bar — แสดง occupancy (admit/total) */}
        <div className="h-1 rounded-full overflow-hidden bg-gray-100">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${rate}%`, backgroundColor: s.fill }}
          />
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            Admit {ward.admit}/{ward.totalBeds}
          </span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: s.badgeBg, color: s.badgeText }}
          >
            {rate}%
          </span>
        </div>

        {/* Detail button */}
        <button
          onClick={() => setModalOpen(true)}
          className="text-[11px] text-gray-500 border border-gray-200 rounded-md py-1.5 w-full hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300 transition-all duration-150"
          style={{ borderWidth: "0.5px" }}
        >
          รายละเอียด →
        </button>
      </div>

      <WardDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        wardCode={ward.ward_code}
        wardLabel={ward.label}
        totalBeds={ward.totalBeds}
        admit={ward.admit}
        date={date}
      />
    </>
  );
}