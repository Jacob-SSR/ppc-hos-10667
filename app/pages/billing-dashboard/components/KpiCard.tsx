// app/pages/billing-dashboard/components/KpiCard.tsx
"use client";

import { motion } from "framer-motion";

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  bg: string;
}

export function KpiCard({ icon: Icon, label, value, sub, accent, bg }: KpiCardProps) {
  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ backgroundColor: bg }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: accent + "22" }}
      >
        <Icon size={20} style={{ color: accent }} strokeWidth={1.8} />
      </div>
      <div>
        <p className="text-xs font-bold tracking-wide" style={{ color: accent }}>
          {label}
        </p>
        <p className="text-xl font-extrabold tabular-nums" style={{ color: accent }}>
          {value}
        </p>
        {sub && (
          <p className="text-[11px] mt-0.5" style={{ color: accent + "99" }}>
            {sub}
          </p>
        )}
      </div>
    </motion.div>
  );
}