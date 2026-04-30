// components/ui/StatCard.tsx
// แทนที่ StatCard() ที่ฝังอยู่ใน app/pages/it-worklog/page.tsx
// และ card pattern ใน OpdSection ที่มี bg/accent/Icon/label/value เหมือนกัน

"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// ── StatCard (สำหรับ IT Worklog — เน้น KPI ตัวเลข) ────────────────────────────

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
      className="rounded-2xl p-5 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
      style={{ backgroundColor: bg }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: accent + "22" }}
      >
        <Icon size={22} style={{ color: accent }} strokeWidth={1.8} />
      </div>
      <p
        className="text-xs font-bold text-center leading-snug tracking-wide"
        style={{ color: accent }}
      >
        {label}
      </p>
      <p
        className="text-lg font-extrabold text-center tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-center" style={{ color: accent + "99" }}>
          {sub}
        </p>
      )}
    </motion.div>
  );
}

// ── DashboardCard (สำหรับ OpdSection — มีปุ่ม "รายละเอียด") ──────────────────

interface DashboardCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  bg: string;
  accent: string;
  /** disabled เมื่อยังไม่มีข้อมูล */
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
      className="rounded-2xl p-5 flex flex-col items-center gap-3 relative transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
      style={{ backgroundColor: bg }}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: accent + "22" }}
      >
        <Icon size={22} style={{ color: accent }} strokeWidth={1.8} />
      </div>

      <p
        className="text-xs font-bold text-center leading-snug tracking-wide"
        style={{ color: accent }}
      >
        {label}
      </p>

      <p
        className="text-lg font-extrabold text-center tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </p>

      <button
        onClick={onClick}
        disabled={!hasData}
        className="flex items-center gap-1 text-xs font-semibold px-4 py-1.5 rounded-full transition-all"
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

/*
  วิธีใช้:
  ─────────────────────────────────────────────────────────────────────────────
  import { StatCard, DashboardCard } from "@/components/ui/StatCard";

  // ใน it-worklog/page.tsx แทนที่ 6 บรรทัดนี้:
  <StatCard icon={TrendingUp} label="งานทั้งหมด" value={totalJobs} sub="รายการ" bg="#E0F2FE" accent="#0369A1" delay={0} />
  <StatCard icon={Clock}      label="เฉลี่ยต่องาน" value={`${avgMin} นาที`} sub={`รวม ${Math.round(totalMin/60)} ชม.`} bg="#FEF9C3" accent="#854D0E" delay={0.04} />
  // ...

  // ใน OpdSection/page.tsx แทนที่ card div ยาว:
  {OPD_CARDS.map((card, i) => (
    <DashboardCard
      key={i}
      icon={card.Icon}
      label={card.label}
      value={getDisplay(card)}
      bg={card.bg}
      accent={card.accent}
      hasData={summary != null && summary[card.visitKey] != null}
      onClick={() => openModal(card)}
    />
  ))}
  ─────────────────────────────────────────────────────────────────────────────
*/