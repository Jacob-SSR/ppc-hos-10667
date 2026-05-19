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

function getTextColor(admit: number, totalBeds: number): string {
  if (totalBeds === 0) return "#9ca3af";
  const rate = admit / totalBeds;
  if (rate >= 0.9) return "#dc2626";
  if (rate >= 0.5) return "#d97706";
  return "#15803d";
}

const SIZE   = 88;
const R      = 36;
const STROKE = 7;
const FONT   = 18;

function DonutCircle({ admit, totalBeds }: { admit: number; totalBeds: number }) {
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const CIRCUM = 2 * Math.PI * R;
  const pct = totalBeds > 0 ? Math.round((admit / totalBeds) * 100) : 0;
  const dashArr = (pct / 100) * CIRCUM;
  const strokeColor = getBedColor(admit, totalBeds);
  const textColor = getTextColor(admit, totalBeds);
  const rotateAttr = `rotate(-90 ${CX} ${CY})`;

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e5e7eb" strokeWidth={STROKE} />
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={strokeColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dashArr} ${CIRCUM}`}
          strokeDashoffset={0}
          transform={rotateAttr}
        />
      </svg>

      {/* Label ตรงกลาง */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span style={{ fontSize: FONT, fontWeight: 700, color: textColor, lineHeight: 1 }}>
          {pct}%
        </span>
        <span style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1, marginTop: 3 }}>
          ครองเตียง
        </span>
      </div>
    </div>
  );
}

export function WardCard({ ward, date }: WardCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const vacant = ward.totalBeds - ward.admit;
  const bedColor = getBedColor(ward.admit, ward.totalBeds);

  return (
    <>
      <div
        style={{ position: "relative" }}
        className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center gap-3 hover:shadow-md transition-all duration-150 cursor-default"
      >
        {/* Bed icon — top right */}
        <div style={{ position: "absolute", top: 10, right: 12 }}>
          <BedDouble size={28} strokeWidth={1.5} style={{ color: bedColor }} />
        </div>

        {/* Ward name */}
        <p className="text-base font-bold text-black text-center leading-snug w-full">
          {ward.label}
        </p>

        {/* Donut — กลางการ์ด */}
        <DonutCircle admit={ward.admit} totalBeds={ward.totalBeds} />

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