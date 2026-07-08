import type { VisitType, ServiceShift } from "@/lib/servicetime.types";
import { getBangkokToday } from "@/lib/thaiDate";

export type Preset = "today" | "custom";

export const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "custom", label: "เลือกช่วงวัน" },
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

// "วันนี้" → start = end = วันนี้ (เวลากรุงเทพ)
export function presetRange(_p: Preset): { start: Date; end: Date } {
  const today = getBangkokToday();
  return { start: today, end: today };
}
