// components/ui/SectionShell.tsx
// แทนที่ wrapper div ที่เขียนซ้ำใน OpdSection, IpdSection,
// BedOccupancyChart, ShiftStatsPage, HomeWardTable, ItWorklog

import { Info } from "lucide-react";

// ── SectionShell ──────────────────────────────────────────────────────────────
// แทนที่:
//   <div className="bg-white border border-gray-200 rounded-lg p-4">
//     <h4 className="text-lg font-bold text-[#717171] mb-3">{title}</h4>
//     ...
//   </div>

interface SectionShellProps {
  title: string;
  /** className เพิ่มเติมของ wrapper หลัก */
  className?: string;
  children: React.ReactNode;
}

export function SectionShell({ title, className = "", children }: SectionShellProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <h4 className="text-lg font-bold text-[#717171] mb-3">{title}</h4>
      {children}
    </div>
  );
}

// ── InfoBar ───────────────────────────────────────────────────────────────────
// แทนที่ info bar ที่เขียนซ้ำใน OpdSection และ IpdSection:
//   <div className="flex items-center gap-2 text-sm text-[#717171] mb-4">
//     <Info size={14} />
//     <span>แสดงข้อมูล การ์ด: <span className="font-bold">{label}</span></span>
//   </div>

interface InfoBarProps {
  label: string;
  prefix?: string;
  /** margin bottom — default "mb-4" */
  mb?: string;
}

export function InfoBar({
  label,
  prefix = "แสดงข้อมูล การ์ด:",
  mb = "mb-4",
}: InfoBarProps) {
  return (
    <div className={`flex items-center gap-2 text-sm text-[#717171] ${mb}`}>
      <Info size={14} className="shrink-0" />
      <span>
        {prefix}{" "}
        <span className="font-bold">{label || "—"}</span>
      </span>
    </div>
  );
}

/*
  วิธีใช้:
  ─────────────────────────────────────────────────────────────────────────────
  import { SectionShell, InfoBar } from "@/components/ui/SectionShell";

  // แทนที่ใน OpdSection:
  <SectionShell title="ภาพรวมผู้รับบริการ OPD วันนี้">
    <InfoBar label={infoLabel} />
    ...cards grid...
  </SectionShell>

  // แทนที่ใน IpdSection:
  <SectionShell title="ภาพรวมผู้รับบริการ IPD วันนี้">
    <InfoBar label={infoLabel} />
    ...ward cards...
  </SectionShell>

  // แทนที่ใน BedOccupancyChart (ไม่มี InfoBar):
  <SectionShell title="อัตราการครองเตียง ปีงบประมาณ 2569">
    ...chart...
  </SectionShell>

  // แทนที่ใน ItWorklog (ไม่ใช้ SectionShell ต้องเพิ่ม mb-3):
  <SectionShell title="บันทึกงานประจำวัน — เจ้าหน้าที่ไอที">
    <InfoBar label={`${filtered.length} รายการ`} prefix="แสดงข้อมูล:" mb="mb-2" />
    ...toolbar...
  </SectionShell>
  ─────────────────────────────────────────────────────────────────────────────
*/