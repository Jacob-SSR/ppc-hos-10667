// app/pages/billing-dashboard/components/UnitCard.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, MapPin } from "lucide-react";
import type { BillingUnitSummary, BillingItemSummary } from "@/types/allTypes";

const fmt = (n: number) => n.toLocaleString("th-TH");

// ── ItemTable ─────────────────────────────────────────────────────────────────
function ItemTable({ items }: { items: BillingItemSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-green-700">
            {["รายการที่ขอเบิก", "สถานะ", "จำนวน", "เรียกเก็บ (฿)", "ชดเชย (฿)", "ไม่ชดเชย (฿)", "หมายเหตุ"].map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 text-left text-white font-semibold whitespace-nowrap border-r border-green-600"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const isOk = item.สถานะ === "ชดเชย";
            const baseColor = i % 2 === 0 ? "#ffffff" : "#f9fafb";
            const remarks = Object.entries(item.หมายเหตุ);
            return (
              <tr
                key={i}
                className="border-b border-gray-100 transition-colors"
                style={{ backgroundColor: baseColor }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0faf4")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = baseColor)}
              >
                <td className="px-3 py-2 text-gray-800 max-w-[280px]">
                  <div className="font-medium">{item.รายการสั้น}</div>
                  <div className="text-[10px] text-gray-400 leading-snug mt-0.5 line-clamp-2">
                    {item.รายการขอเบิก}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isOk ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {item.สถานะ}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700">
                  {fmt(item.จำนวน)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                  {fmt(item.เรียกเก็บ)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-green-700">
                  {fmt(item.ชดเชย)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-red-600">
                  {fmt(item.ไม่ชดเชย)}
                </td>
                <td className="px-3 py-2">
                  {remarks.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {remarks.map(([k, v]) => (
                        <span
                          key={k}
                          className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium"
                        >
                          {k} ×{v}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── UnitCard ──────────────────────────────────────────────────────────────────
interface UnitCardProps {
  unit: BillingUnitSummary;
}

export function UnitCard({ unit }: UnitCardProps) {
  const [open, setOpen] = useState(unit.isHospital);
  const compRate = unit.อัตราชดเชย;
  const rateColor =
    compRate >= 90 ? "#3B6D11" : compRate >= 60 ? "#854F0B" : "#A32D2D";

  return (
    <motion.div
      className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            unit.isHospital ? "bg-blue-50" : "bg-green-50"
          }`}
        >
          {unit.isHospital ? (
            <Building2 size={18} className="text-blue-700" strokeWidth={1.8} />
          ) : (
            <MapPin size={18} className="text-green-700" strokeWidth={1.8} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{unit.หน่วยบริการ}</p>
          <p className="text-[11px] text-gray-400">
            HCODE {unit.hcodeKey} · {fmt(unit.รายการทั้งหมด)} รายการ
          </p>
        </div>

        <div className="flex items-center gap-6 shrink-0 text-right">
          <div>
            <p className="text-[10px] text-gray-400 font-medium">เรียกเก็บ</p>
            <p className="text-sm font-bold text-gray-800 tabular-nums">{fmt(unit.เรียกเก็บ)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium">ชดเชย</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: rateColor }}>
              {fmt(unit.ชดเชย)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium">อัตรา</p>
            <p className="text-sm font-extrabold tabular-nums" style={{ color: rateColor }}>
              {compRate}%
            </p>
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="px-5 py-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: rateColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${compRate}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: rateColor }}>
                  {compRate}% ชดเชย
                </span>
              </div>
              <ItemTable items={unit.items} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}