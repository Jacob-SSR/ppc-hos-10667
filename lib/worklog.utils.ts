// lib/worklog.utils.ts
// date/label helpers สำหรับ IT Worklog
// แยกออกจาก app/pages/it-worklog/page.tsx

import { THAI_MONTHS } from "./worklog.constants";

// ── Date formatters ───────────────────────────────────────────────────────────

/** "2025-03-13" → "13 มี.ค." */
export function fmtShort(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  return `${day} ${THAI_MONTHS[m] ?? ""}`;
}

/** "2025-03" (หรือ "2025-03-01") → "มี.ค. 68" */
export function fmtMonth(d: string): string {
  const [y, m] = d.split("-").map(Number);
  return `${THAI_MONTHS[m]} ${String(y + 543).slice(2)}`;
}

// ── Cutoff helper ─────────────────────────────────────────────────────────────

/**
 * คืน ISO date string ของวันที่ dateRange วันที่แล้ว
 * ใช้ filter allData ใน useWorklogData
 */
export function getCutoffDate(dateRange: number): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dateRange);
  return cutoff.toISOString().slice(0, 10);
}
