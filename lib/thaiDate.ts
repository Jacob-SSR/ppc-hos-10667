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
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** "YYYY-MM-DD" → "15 มี.ค. 2568" (เต็มรูปแบบไทย) */
export function toThaiDateLong(dateStr: string): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return dateStr;
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
}
