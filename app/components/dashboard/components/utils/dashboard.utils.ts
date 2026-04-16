import { DatePreset } from "../../types/dashboard.types";

// ─── Date Formatting ──────────────────────────────────────────────────────────

export function fmtDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function toThaiDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
}

export function toThaiDateLabel(start: string, end: string): string {
  const s = toThaiDate(start);
  const e = toThaiDate(end);
  return s === e ? s : `${s} – ${e}`;
}

// ─── Date Preset Ranges ───────────────────────────────────────────────────────

export function getPresetRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "สัปดาห์นี้") {
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { start: mon, end: today };
  }

  if (preset === "เดือนนี้") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: today,
    };
  }

  // "วันนี้" (default)
  return { start: today, end: today };
}

// ─── Gender ───────────────────────────────────────────────────────────────────

export function isMale(sex: string): boolean {
  return sex === "1";
}
