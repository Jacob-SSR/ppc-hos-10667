import type {
  ServiceScope,
  VisitType,
  ServiceShift,
} from "@/lib/servicetime.types";
import {
  getBangkokToday,
  fiscalYearRange,
  recentFiscalYears,
  getCurrentCalendarYear,
} from "@/lib/thaiDate";

export type Preset = "month" | "7d" | "fiscal" | "calendar" | "custom";

export const PRESETS: { key: Preset; label: string }[] = [
  { key: "month", label: "เดือนนี้" },
  { key: "7d", label: "7 วัน" },
  { key: "fiscal", label: "ปีงบ" },
  { key: "calendar", label: "ปีปฏิทิน" },
  { key: "custom", label: "กำหนดเอง" },
];

export const FISCAL_YEARS = recentFiscalYears(5); // [2569, 2568, 2567, 2566, 2565]
export const CALENDAR_YEARS = Array.from(
  { length: 5 },
  (_, i) => getCurrentCalendarYear() - i,
);

// ช่วงปีงบ — cap ปลายทางไม่ให้เกินวันนี้ (ปีงบปัจจุบัน = ยอดสะสมถึงปัจจุบัน)
export function fiscalRange(beYear: number): { start: Date; end: Date } {
  const { start, end } = fiscalYearRange(beYear);
  const today = getBangkokToday();
  return { start, end: end > today ? today : end };
}
// ช่วงปีปฏิทิน (พ.ศ.) → 1 ม.ค. – 31 ธ.ค. · cap ปลายทางไม่ให้เกินวันนี้
export function calendarRange(beYear: number): { start: Date; end: Date } {
  const ce = beYear - 543;
  const today = getBangkokToday();
  const end = new Date(ce, 11, 31);
  return { start: new Date(ce, 0, 1), end: end > today ? today : end };
}

export const SCOPES: { key: ServiceScope; label: string }[] = [
  { key: "opd", label: "OPD" },
  { key: "er", label: "ER" },
  { key: "all", label: "OPD+ER" },
];
export const VISIT_TYPES: { key: VisitType; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "walkin", label: "Walk-in" },
  { key: "appt", label: "นัด" },
];
export const SHIFTS: { key: ServiceShift; label: string; title?: string }[] = [
  { key: "all", label: "ทั้งวัน" },
  { key: "morning", label: "เช้า", title: "08:30–16:30" },
  { key: "evening", label: "บ่าย", title: "16:30–00:30" },
  { key: "night", label: "ดึก", title: "00:30–08:30" },
];

export function presetRange(p: Preset): { start: Date; end: Date } {
  const today = getBangkokToday();
  if (p === "7d") {
    const s = new Date(today);
    s.setDate(s.getDate() - 6);
    return { start: s, end: today };
  }
  // month
  return {
    start: new Date(today.getFullYear(), today.getMonth(), 1),
    end: today,
  };
}
