// ─── palette + generic formatters ────────────────────────────────────────────
export const C = {
  green: "#2f9e6a",
  greenL: "#e4f4ec",
  blue: "#378ADD",
  blueL: "#e6f1fb",
  amber: "#ef9f27",
  amberL: "#faeeda",
  red: "#e24b4a",
  redL: "#fcebeb",
  teal: "#1d9e75",
  tealL: "#e1f5ee",
  purple: "#7f77dd",
  purpleL: "#ecebf9",
  gray: "#888780",
  grayL: "#f1efe8",
};

export const fmt = (n: number) => n.toLocaleString("th-TH");
export const mins = (v: number | null) => (v == null ? "-" : `${v} นาที`);
export const tip = {
  contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" },
};

// สีตาม "เฉลี่ยเทียบเป้า" (ยิ่งน้อยยิ่งดี)
export function timeColor(
  avg: number | null,
  target: number | null,
): { accent: string; bg: string } {
  if (avg == null || target == null) return { accent: C.gray, bg: C.grayL };
  if (avg <= target) return { accent: C.green, bg: C.greenL };
  if (avg <= target * 1.5) return { accent: C.amber, bg: C.amberL };
  return { accent: C.red, bg: C.redL };
}
// สีตาม "%ผ่านเกณฑ์" (ยิ่งมากยิ่งดี) — goal = เป้าหมาย % (ปรับได้)
export function pctColor(
  pct: number | null,
  goal = 80,
): { accent: string; bg: string } {
  if (pct == null) return { accent: C.gray, bg: C.grayL };
  if (pct >= goal) return { accent: C.green, bg: C.greenL };
  if (pct >= goal - 20) return { accent: C.amber, bg: C.amberL };
  return { accent: C.red, bg: C.redL };
}

// ─── metadata ราย stage (สี + ป้ายสั้น) — คีย์ตรงกับ STAGE_DEFS ฝั่ง server ──────
export const STAGE_META: Record<string, { short: string; color: string }> = {
  wait_screening: { short: "รอคัดกรอง", color: "#3b82f6" },
  screening: { short: "คัดกรอง", color: "#6366f1" },
  wait_doctor: { short: "รอตรวจ", color: "#8b5cf6" },
  consult: { short: "ตรวจ", color: "#a855f7" },
  lab_wait: { short: "รอแลป", color: "#059669" },
  lab_process: { short: "LAB", color: "#10b981" },
  xray_wait: { short: "รอ X-ray", color: "#0d9488" },
  xray_process: { short: "X-ray", color: "#2dd4bf" },
  wait_pharmacy: { short: "รอรับยา", color: "#f59e0b" },
};
export const stageColor = (key: string) => STAGE_META[key]?.color ?? C.gray;
export const stageShort = (key: string, fallback: string) =>
  STAGE_META[key]?.short ?? fallback;

// นาทีของวัน → "HH:MM"
export const toHM = (m: number | null) =>
  m == null
    ? "-"
    : `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
// ISO date (YYYY-MM-DD) → DD/MM/พ.ศ.
export const toDMY = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
};
// นาที (ทศนิยมได้) → "H:MM:SS"
export const toHMS = (min: number | null): string => {
  if (min == null) return "-";
  const totalSec = Math.max(0, Math.round(min * 60));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const BUCKET_COLORS = ["#2f9e6a", "#84cc16", "#ef9f27", "#f2711c", "#e24b4a"];
export { BUCKET_COLORS };
