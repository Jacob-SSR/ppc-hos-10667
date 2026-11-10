export const PT_TREATMENT_TITLE = "สรุปค่ารักษาทางด้านกายภาพแบบเลือกหัตถการ";
export const PT_DEFAULT_ICODES = [
  "3050121", "3140481", "3140480", "3050157", "3050158", "3050170",
  "3050171", "3050172", "3002120", "3140479", "3002121", "3002123",
  "3002128", "3002127", "3002125", "3002126", "3002122", "3140407",
];
export const PT_MAX_SELECTION = 200;
export interface PtTreatmentFilters { start: string; end: string; icodes: string[]; byRight: boolean }
export interface PtTreatmentItem { icode: string; name: string }
export interface PtTreatmentTotals { patients: number; visits: number; lines: number; quantity: number; charge: number }
export interface PtTreatmentRow extends PtTreatmentTotals { icode: string; name: string; pttype: string; pttype_name: string }
export interface PtTreatmentReport extends PtTreatmentFilters {
  rows: PtTreatmentRow[]; totals: PtTreatmentTotals; updatedAt: string;
}

function validDay(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error("กรุณาระบุวันที่ในรูปแบบ YYYY-MM-DD");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw Error("วันที่ไม่ถูกต้อง");
  return value;
}
export function parsePtTreatmentFilters(params: URLSearchParams): PtTreatmentFilters {
  const start = validDay(params.get("start")), end = validDay(params.get("end"));
  if (start > end) throw Error("วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด");
  const raw = params.get("icodes");
  if (!raw || raw.length > 6500) throw Error("กรุณาเลือกหัตถการอย่างน้อย 1 รายการ");
  const codes = raw.split(",").map(c => c.trim());
  if (codes.some(c => !/^[A-Za-z0-9_-]{1,30}$/.test(c))) throw Error("รหัสหัตถการไม่ถูกต้อง");
  const icodes = [...new Set(codes)].sort();
  if (icodes.length > PT_MAX_SELECTION) throw Error(`เลือกได้ไม่เกิน ${PT_MAX_SELECTION} หัตถการต่อรายงาน`);
  const group = params.get("group") ?? "procedure";
  if (!["procedure", "right"].includes(group)) throw Error("รูปแบบการแยกรายงานไม่ถูกต้อง");
  return { start, end, icodes, byRight: group === "right" };
}

export const PT_TREATMENT_CATALOG_SQL = `SELECT icode, COALESCE(NULLIF(TRIM(name), ''), icode) AS name
  FROM nondrugitems WHERE icode IS NOT NULL AND icode <> '' ORDER BY name, icode`;

/** Sum actual selected line amounts; never sum vn_stat.income after an item join. */
export function ptTreatmentQueries(filters: PtTreatmentFilters) {
  const placeholders = filters.icodes.map(() => "?").join(",") || "NULL";
  const base = `FROM ovst o JOIN opitemrece oo ON oo.vn = o.vn
    WHERE o.vstdate BETWEEN ? AND ? AND oo.icode IN (${placeholders})`;
  const aggregate = `COUNT(DISTINCT o.hn) AS patients, COUNT(DISTINCT o.vn) AS visits,
    COUNT(*) AS lines, COALESCE(SUM(oo.qty), 0) AS quantity,
    COALESCE(SUM(oo.sum_price), 0) AS charge`;
  const selected = filters.byRight
    ? "COALESCE(o.pttype, '') AS pttype, COALESCE(ptt.name, 'ไม่ระบุสิทธิ') AS pttype_name"
    : "'' AS pttype, '' AS pttype_name";
  const joined = `FROM ovst o JOIN opitemrece oo ON oo.vn = o.vn
    LEFT JOIN nondrugitems n ON n.icode = oo.icode
    ${filters.byRight ? "LEFT JOIN pttype ptt ON ptt.pttype = o.pttype" : ""}
    WHERE o.vstdate BETWEEN ? AND ? AND oo.icode IN (${placeholders})`;
  const params = [filters.start, filters.end, ...filters.icodes];
  return {
    rows: { sql: `SELECT oo.icode, COALESCE(n.name, oo.icode) AS name, ${selected}, ${aggregate}
      ${joined} GROUP BY oo.icode, n.name${filters.byRight ? ", o.pttype, ptt.name" : ""}
      ORDER BY name, oo.icode${filters.byRight ? ", pttype" : ""}`, params },
    totals: { sql: `SELECT ${aggregate} ${base}`, params },
  };
}

export function ptTreatmentExport(report: PtTreatmentReport): Record<string, unknown>[] {
  const convert = (row: PtTreatmentRow | PtTreatmentTotals, total = false): Record<string, unknown> => ({
    วันที่เริ่ม: report.start, วันที่สิ้นสุด: report.end,
    รหัสหัตถการ: "icode" in row ? row.icode : "",
    หัตถการ: "name" in row ? row.name : "รวมทั้งรายงาน (คนและ visit ไม่ซ้ำ)",
    ...(report.byRight ? { รหัสสิทธิ: !total && "pttype" in row ? row.pttype : "", สิทธิการรักษา: !total && "pttype_name" in row ? row.pttype_name : "" } : {}),
    ผู้ป่วยไม่ซ้ำ_ราย: row.patients, ครั้งรับบริการ_VN: row.visits,
    จำนวนรายการ: row.lines, จำนวนหน่วย: row.quantity, ค่าหัตถการ_บาท: row.charge,
  });
  return [...report.rows.map(row => convert(row)), convert(report.totals, true)];
}
