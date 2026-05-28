// app/components/dashboard/live/KpiCard.tsx
// KPI card สำหรับ dashboard — รองรับทั้งแบบสีพื้น (accident/drug/sepsis)
// และ highlight (sepsis เสียชีวิต)
"use client";

import { motion } from "framer-motion";

interface Props {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  /** สีตัวอักษร/ไอคอน */
  accent: string;
  /** สีพื้นการ์ด */
  bg: string;
  /** ขอบแดงเน้น (เช่น KPI เสียชีวิต) */
  highlight?: boolean;
}

export function KpiCard({ icon: Icon, label, value, sub, accent, bg, highlight }: Props) {
  return (
    <motion.div
      className={`rounded-2xl p-5 flex flex-col gap-2 ${highlight ? "ring-2 ring-red-300" : ""}`}
      style={{ backgroundColor: bg }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: accent + "22" }}
      >
        <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
      </div>
      <p className="text-xs font-bold tracking-wide" style={{ color: accent }}>
        {label}
      </p>
      <p className="text-2xl font-extrabold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px]" style={{ color: accent + "99" }}>
          {sub}
        </p>
      )}
    </motion.div>
  );
}
