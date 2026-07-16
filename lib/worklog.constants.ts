// lib/worklog.constants.ts
// constants ทั้งหมดที่เกี่ยวกับ IT Worklog
// แยกออกจาก app/pages/it-worklog/page.tsx

export const THAI_MONTHS = [
  "",
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;

export const TASK_CFG: Record<string, { color: string; short: string }> = {
  "ระบบ HosXP": { color: "#0ea5e9", short: "HosXP" },
  "ระบบ KPHIS": { color: "#3aa36a", short: "KPHIS" },
  "ระบบ Network": { color: "#10b981", short: "Network" },
  คอมพิวเตอร์และอุปกรณ์ต่อพ่วง: { color: "#f59e0b", short: "คอมฯ" },
  "ระบบข้อมูล และรายงาน": { color: "#8b5cf6", short: "รายงาน" },
  ระบบอื่นๆ: { color: "#94a3b8", short: "อื่นๆ" },
  ระบบเอกสาร: { color: "#ec4899", short: "เอกสาร" },
  "ระบบ  HosOffice": { color: "#f97316", short: "HosOffice" },
  "ระบบ  GTWOffice": { color: "#14b8a6", short: "GTWOffice" },
  ระบบอินทราเน็ต: { color: "#55b882", short: "Intranet" },
  ให้คำปรึกษาด้านไอที: { color: "#64748b", short: "ปรึกษา" },
  "แก้ไขปรับปรุง ระบบความเสี่ยง": { color: "#ef4444", short: "ความเสี่ยง" },
};

export const STAFF_COLORS: Record<string, string> = {
  "นายรุจิศักดิ์ บวรชาติ": "#3aa36a",
  "นายชิต คุมสุข": "#0ea5e9",
  "นายวีระเทพ ทองใส": "#f59e0b",
  "นายทีปกร เสงี่ยมศักดิ์": "#8b5cf6",
};

// shortColor map สำหรับ recharts legend/bar
export const SHORT_COLOR: Record<string, string> = Object.fromEntries(
  Object.values(TASK_CFG).map(({ short, color }) => [short, color]),
);

// helpers เล็กๆ ที่ขึ้นอยู่กับ constants — วางไว้ที่นี่เพื่อไม่ให้ต้อง import 2 ไฟล์
export function taskColor(task: string): string {
  return TASK_CFG[task]?.color ?? "#94a3b8";
}

export function taskShort(task: string): string {
  return TASK_CFG[task]?.short ?? task;
}

// ── กลุ่มงาน Software / Hardware ──────────────────────────────────────────────
// ใช้สรุปความทันเวลาแยกกลุ่ม — เพิ่ม/ย้ายรายการได้ที่นี่ที่เดียว
export const HARDWARE_TASKS = new Set<string>([
  "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง",
  "ระบบ Network",
]);

export type TaskGroup = "Software" | "Hardware";

export function taskGroup(task: string): TaskGroup {
  return HARDWARE_TASKS.has((task ?? "").trim()) ? "Hardware" : "Software";
}

// ── SLA Report sections ───────────────────────────────────────────────────────
// Service Desk = งานให้คำปรึกษา, Report = ระบบข้อมูลและรายงาน — แยกรายงานคนละ section
export const SLA_SECTIONS = [
  {
    title: "Service Desk (Service Level Agreement)",
    mainTask: "ให้คำปรึกษาด้านไอที",
  },
  {
    title: "Report (Service Level Agreement)",
    mainTask: "ระบบข้อมูล และรายงาน",
  },
] as const;
