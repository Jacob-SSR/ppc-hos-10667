// lib/worklog.utils.ts
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

// ── Time filter ───────────────────────────────────────────────────────────────

/** ตัวกรองช่วงเวลาแบบใหม่: วันนี้ / เดือนนี้ / รายปี พ.ศ. / กำหนดเอง */
export type TimeFilter =
  | { type: "today" }
  | { type: "thisMonth" }
  | { type: "year"; beYear: number } // ปี พ.ศ. เช่น 2569
  | { type: "custom"; start: string; end: string }; // ISO "YYYY-MM-DD"

/** ปี พ.ศ. ที่ให้เลือกบนหน้า it-worklog */
export const BE_YEARS = [2569, 2568, 2567, 2566, 2565];

/** Date → "YYYY-MM-DD" ตามเวลาท้องถิ่น (เลี่ยง timezone เพี้ยนจาก toISOString) */
function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getDateBounds(f: TimeFilter): { start: string; end: string } {
  const now = new Date();
  switch (f.type) {
    case "today": {
      const t = isoLocal(now);
      return { start: t, end: t };
    }
    case "thisMonth": {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      return {
        start: `${y}-${m}-01`,
        end: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
      };
    }
    case "year": {
      const ce = f.beYear - 543; // พ.ศ. → ค.ศ.
      return { start: `${ce}-01-01`, end: `${ce}-12-31` };
    }
    case "custom": {
      return {
        start: f.start || "0000-01-01",
        end: f.end || "9999-12-31",
      };
    }
  }
}
