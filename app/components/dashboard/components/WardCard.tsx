// app/components/dashboard/components/WardCard.tsx
"use client";

import { useState } from "react";
import { BedDouble } from "lucide-react";
import type { WardDisplayItem } from "@/app/components/dashboard/types/dashboard.types";
import WardDetailModal from "./WardDetailModal";

interface WardCardProps {
  ward: WardDisplayItem;
  date: string;
}

function getBedColor(admit: number, totalBeds: number): string {
  if (totalBeds === 0) return "#9ca3af";
  const rate = admit / totalBeds;
  if (rate >= 0.9) return "#ef4444";
  if (rate >= 0.5) return "#f59e0b";
  return "#16a34a";
}

function getBadgeStyle(admit: number, totalBeds: number) {
  if (totalBeds === 0) return { bg: "#f3f4f6", text: "#6b7280", border: "#e5e7eb" };
  const rate = admit / totalBeds;
  if (rate >= 0.9) return { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" };
  if (rate >= 0.5) return { bg: "#fffbeb", text: "#d97706", border: "#fde68a" };
  return { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" };
}

export function WardCard({ ward, date }: WardCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const vacant = ward.totalBeds - ward.admit;
  const bedColor = getBedColor(ward.admit, ward.totalBeds);
  const rate = ward.totalBeds > 0
    ? Math.round((ward.admit / ward.totalBeds) * 100)
    : 0;
  const badge = getBadgeStyle(ward.admit, ward.totalBeds);

  return (
    <>
      <div className="relative bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center gap-3 hover:shadow-md transition-all duration-150 cursor-default">

        {/* % ครองเตียง — มุมขวาบน */}
        <div
          className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full border"
          style={{ backgroundColor: badge.bg, color: badge.text, borderColor: badge.border }}
        >
          {rate}%
        </div>

        {/* Ward name */}
        <p className="text-base font-bold text-black text-center leading-snug">
          {ward.label}
        </p>

        {/* Bed icon — สีตาม occupancy */}
        <BedDouble size={52} strokeWidth={1.5} style={{ color: bedColor }} />

        {/* Admit / total */}
        <p className="text-base font-bold text-black text-center">
          Admit {ward.admit}/{ward.totalBeds} เตียง
        </p>

        {/* ว่าง */}
        <p className="text-sm font-medium text-black text-center">
          (ว่าง {vacant})
        </p>

        {/* Detail button */}
        <button
          onClick={() => setModalOpen(true)}
          className="border border-gray-300 rounded-full px-5 py-1.5 text-sm font-medium text-black hover:bg-gray-100 transition-all duration-150 flex items-center gap-1"
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