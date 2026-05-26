// app/components/ui/StatCard.tsx
"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  bg: string;
  accent: string;
  delay?: number;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  bg,
  accent,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      className="rounded-2xl p-3 md:p-5 flex flex-col items-center gap-1.5 md:gap-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
      style={{ backgroundColor: bg }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
    >
      <div
        className="w-8 h-8 md:w-11 md:h-11 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: accent + "22" }}
      >
        <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
      </div>
      <p
        className="text-[10px] md:text-xs font-bold text-center leading-snug tracking-wide"
        style={{ color: accent }}
      >
        {label}
      </p>
      <p
        className="text-base md:text-lg font-extrabold text-center tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[9px] md:text-[10px] text-center" style={{ color: accent + "99" }}>
          {sub}
        </p>
      )}
    </motion.div>
  );
}

interface DashboardCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  bg: string;
  accent: string;
  hasData?: boolean;
  onClick?: () => void;
}

export function DashboardCard({
  icon: Icon,
  label,
  value,
  bg,
  accent,
  hasData = false,
  onClick,
}: DashboardCardProps) {
  return (
    <div
      className="rounded-2xl p-4 md:p-5 flex flex-col items-center gap-2 md:gap-3 relative transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
      style={{ backgroundColor: bg }}
    >
      <div
        className="w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: accent + "22" }}
      >
        <Icon size={20} style={{ color: accent }} strokeWidth={1.8} />
      </div>
      <p
        className="text-[11px] md:text-xs font-bold text-center leading-snug tracking-wide"
        style={{ color: accent }}
      >
        {label}
      </p>
      <p
        className="text-base md:text-lg font-extrabold text-center tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </p>
      <button
        onClick={onClick}
        disabled={!hasData}
        className="flex items-center gap-1 text-xs font-semibold px-3 py-1 md:px-4 md:py-1.5 rounded-full transition-all"
        style={{
          backgroundColor: accent + "18",
          color: accent,
          border: `1.5px solid ${accent}40`,
          cursor: hasData ? "pointer" : "not-allowed",
          opacity: hasData ? 1 : 0.4,
        }}
      >
        รายละเอียด <ArrowRight size={11} />
      </button>
    </div>
  );
}