export const POPULATION_COLUMNS = ["HN", "CID", "ชื่อ-นามสกุล", "เพศ", "อายุ (ปี)", "อายุ (เดือน)", "ประเภททะเบียน", "บ้านเลขที่", "ถนน", "หมู่", "หมู่บ้าน", "ที่อยู่"] as const;
export type PopulationRow = Record<string, string | number | null> & { villageId: number | string };
export interface PopulationVillage { id: number | string; moo: string | number | null; name: string | null }
export interface PopulationFilters {
  moo: string; village: string; sex: string; type: string; search: string;
}
export const EMPTY_POPULATION_FILTERS: PopulationFilters = { moo: "", village: "", sex: "", type: "", search: "" };
const text = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("th");
export const normalizeMoo = (value: unknown) => /^\d+$/.test(text(value)) ? String(Number(value)) : text(value);

export function filterPopulation(rows: PopulationRow[], filters: PopulationFilters) {
  return rows.filter(row =>
    (!filters.moo || normalizeMoo(row["หมู่"]) === filters.moo) &&
    (!filters.village || String(row.villageId) === filters.village) &&
    (!filters.sex || row["เพศ"] === filters.sex) &&
    (!filters.type || String(row["ประเภททะเบียน"]) === filters.type) &&
    (!text(filters.search) || POPULATION_COLUMNS.some(key => text(row[key]).includes(text(filters.search)))),
  );
}

export function sortPopulation(rows: PopulationRow[], key: string, ascending: boolean) {
  const sign = ascending ? 1 : -1;
  return [...rows].sort((a, b) => sign * String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "th", { numeric: true }));
}

export function populationExportRows(rows: PopulationRow[]) {
  return rows.map((row, index) => ({ "ลำดับ": index + 1, ...Object.fromEntries(POPULATION_COLUMNS.map(key => [key, row[key] ?? ""])) }));
}

export function summarizePopulation(rows: PopulationRow[]) {
  const groups = new Map<string, { id: string; label: string; male: number; female: number; unknown: number; total: number }>();
  let male = 0, female = 0, unknown = 0;
  for (const row of rows) {
    const id = String(row.villageId);
    const group = groups.get(id) ?? { id, label: `หมู่ ${normalizeMoo(row["หมู่"]) || "ไม่ระบุ"} · ${row["หมู่บ้าน"] || "ไม่ระบุหมู่บ้าน"}`, male: 0, female: 0, unknown: 0, total: 0 };
    if (row["เพศ"] === "ชาย") { male++; group.male++; }
    else if (row["เพศ"] === "หญิง") { female++; group.female++; }
    else { unknown++; group.unknown++; }
    group.total++;
    groups.set(id, group);
  }
  return { total: rows.length, male, female, unknown,
    villages: [...groups.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "th", { numeric: true }) || a.id.localeCompare(b.id, "th", { numeric: true })) };
}
