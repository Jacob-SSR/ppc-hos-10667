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
  if (rate >= 0.9) return "#ef4444"; // เต็ม → แดง
  if (rate >= 0.5) return "#f59e0b"; // กลาง → เหลือง
  return "#16a34a";                  // ว่าง  → เขียว
}

export function WardCard({ ward, date }: WardCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const vacant = ward.totalBeds - ward.admit;
  const bedColor = getBedColor(ward.admit, ward.totalBeds);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center gap-3 hover:shadow-md transition-all duration-150 cursor-default">
        {/* Ward name */}
        <p className="text-base font-bold text-black text-center leading-snug">
          {ward.label}
        </p>

        {/* Bed icon — สีตาม occupancy */}
        <BedDouble
          size={52}
          strokeWidth={1.5}
          style={{ color: bedColor }}
        />

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