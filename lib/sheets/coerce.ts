// lib/sheets/coerce.ts
// Helper แปลงค่า + นับ frequency — เดิมซ้ำใน accident/drug/sepsis/tb/homeward/stroke ทุกตัว

/** unknown → string (trim, null-safe) */
export function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** unknown → number (คืน 0 ถ้า parse ไม่ได้) */
export function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

/** unknown → number | null (รองรับ comma separator, คืน null ถ้าว่าง/ไม่ใช่เลข) */
export function toNumOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) || !isFinite(n) ? null : n;
}

/**
 * unknown → ร้อยละ (number) | null — สำหรับ cell ตัวชี้วัด KPI ที่ format เป็น "94.11%"
 * (Sheets API คืนค่าตาม format ของ cell มาเป็น formatted string)
 * ถ้า cell ไม่ได้ format เป็น % ให้ใส่ตัวเลขร้อยละตรงๆ ในชีต (เช่น 94.1)
 */
export function toPercentOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").replace(/%/g, "").trim());
  return isNaN(n) || !isFinite(n) ? null : Math.round(n * 10) / 10;
}

/**
 * นับจำนวนตาม key — แทนที่ countBy/count ที่ซ้ำใน buildSummary ทุก route
 * ค่าว่างนับเป็น "ไม่ระบุ"
 */
export function countBy<T>(rows: T[], key: keyof T): Record<string, number> {
  const map: Record<string, number> = {};
  rows.forEach((r) => {
    const v = String(r[key] ?? "ไม่ระบุ").trim() || "ไม่ระบุ";
    map[v] = (map[v] || 0) + 1;
  });
  return map;
}

/** นับจาก array ของ string (เช่นหลัง split tag) */
export function countValues(values: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  values.forEach((v) => {
    const k = v.trim() || "ไม่ระบุ";
    map[k] = (map[k] || 0) + 1;
  });
  return map;
}

/** เฉลี่ยของตัวเลข (กรอง 0/null ออกตาม predicate) */
export function average(
  nums: (number | null | undefined)[],
  filter: (n: number) => boolean = (n) => n > 0,
): number {
  const valid = nums.filter((n): n is number => n != null && filter(n));
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((s, n) => s + n, 0) / valid.length);
}
