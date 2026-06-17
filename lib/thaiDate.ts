// lib/thaiDate.ts
// Date helper ฝั่ง client — แหล่งเดียว
// เดิม fmt/toThaiDate/getToday ซ้ำใน OpdSection, useIpdData, dashboard.utils, DateRangeToolbar ฯลฯ

/** Date → "YYYY-MM-DD" */
export function fmtDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** "YYYY-MM-DD" (ค.ศ.) → "DD/MM/พ.ศ." */
export function toThaiDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
}

/** label ช่วงวันที่ — ถ้า start===end คืนวันเดียว */
export function toThaiDateLabel(start: string, end: string): string {
  const s = toThaiDate(start);
  const e = toThaiDate(end);
  return s === e ? s : `${s} – ${e}`;
}

/** วันนี้ใน timezone Asia/Bangkok (ตัดเวลาออก) */
export function getBangkokToday(): Date {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const THAI_MONTHS_SHORT = [
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
];

/** "YYYY-MM-DD" → "15 มี.ค. 2568" (เต็มรูปแบบไทย) */
export function toThaiDateLong(dateStr: string): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return dateStr;
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
}

// ── ปีงบประมาณ (เริ่ม 1 ต.ค.) ──────────────────────────────────────────────

/** ปีงบประมาณปัจจุบัน (พ.ศ.) — มิ.ย. 2569 → คืน 2569 */
export function getCurrentFiscalYear(): number {
  const today = getBangkokToday();
  const beYear = today.getFullYear() + 543;
  // ต.ค.–ธ.ค. (month index 9–11) นับเป็นปีงบถัดไป
  return today.getMonth() >= 9 ? beYear + 1 : beYear;
}

/** ช่วงวันของปีงบ (พ.ศ.) → 1 ต.ค. (ปีก่อน) ถึง 30 ก.ย. */
export function fiscalYearRange(beYear: number): { start: Date; end: Date } {
  const ceEnd = beYear - 543; // เช่น 2569 → 2026
  return {
    start: new Date(ceEnd - 1, 9, 1), // 1 ต.ค. ปีก่อน
    end: new Date(ceEnd, 8, 30), // 30 ก.ย.
  };
}

/** ช่วงวันของ "เดือนที่แล้ว" */
export function lastMonthRange(): { start: Date; end: Date } {
  const today = getBangkokToday();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0); // วันสุดท้ายเดือนก่อน
  return { start, end };
}

/** รายการปีงบล่าสุด N ปี เช่น [2569, 2568, 2567, 2566, 2565] */
export function recentFiscalYears(count = 5): number[] {
  const cur = getCurrentFiscalYear();
  return Array.from({ length: count }, (_, i) => cur - i);
}

/** ปีปฏิทินปัจจุบัน (พ.ศ.) */
export function getCurrentCalendarYear(): number {
  return getBangkokToday().getFullYear() + 543;
}

/** ช่วง "ปีนี้" = 1 ม.ค. ปีปัจจุบัน ถึงวันนี้ */
export function thisYearToDate(): { start: Date; end: Date } {
  const today = getBangkokToday();
  return {
    start: new Date(today.getFullYear(), 0, 1), // 1 ม.ค.
    end: today,
  };
}
