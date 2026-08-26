// lib/drugUsage.service.ts
// สรุปยอดการใช้เวชภัณฑ์ยาตามมูลค่าการใช้ทั้งหมดในสถานบริการ
//
// แหล่งข้อมูล = opitemrece (รายการค่าใช้จ่ายรายบรรทัด) JOIN drugitems (ทะเบียนเวชภัณฑ์ยา)
// การ inner join กับ drugitems ทำให้เหลือเฉพาะ "เวชภัณฑ์ยา" (ตัด lab / x-ray / ค่าบริการ ออก)
//
// อ้างอิงจาก query ต้นฉบับที่ใช้ตรวจสอบหน้างาน:
//   select d.name, d.strength, d.units, count(distinct vn), sum(qty), sum(o.sum_price)
//     from opitemrece o, drugitems d
//    where o.icode = d.icode and o.vstdate between ? and ?
//    group by d.name, d.strength, d.units order by sum_price desc
//
// โครงสร้างตารางต่างกันตามเวอร์ชัน HOSxP → คอลัมน์ที่ไม่การันตี (strength/units/an)
// จะถูกตรวจจาก information_schema ก่อนนำไปประกอบ SQL
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

// ─── ตรวจคอลัมน์จริงของตาราง (cache ต่อ process) ───────────────────────────────
const colsCache = new Map<string, Set<string>>();

async function tableColumns(table: string): Promise<Set<string>> {
  const cached = colsCache.get(table);
  if (cached) return cached;
  let cols: Set<string>;
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT LOWER(COLUMN_NAME) AS col
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    cols = new Set(rows.map((r) => String(r.col)));
  } catch {
    cols = new Set<string>();
  }
  colsCache.set(table, cols);
  return cols;
}

/** คอลัมน์ที่ "อาจไม่มี" → คืน expression ที่ปลอดภัย (ชื่อคอลัมน์มาจาก whitelist ในโค้ด ไม่ใช่ input ผู้ใช้) */
function optionalCol(
  cols: Set<string>,
  alias: string,
  col: string,
  fallback: string,
): string {
  return cols.has(col) ? `COALESCE(${alias}.${col}, ${fallback})` : fallback;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DrugUsageDrugRow {
  icode: string;
  name: string;
  strength: string;
  units: string;
  /** จำนวนบรรทัดที่สั่งใช้ */
  order_count: number;
  /** จำนวนหน่วยที่จ่ายรวม */
  qty: number;
  vn_count: number;
  hn_count: number;
  value: number;
  opd_value: number;
  ipd_value: number;
}

export interface DrugUsageTrendRow {
  date: string;
  value: number;
  qty: number;
  vn_count: number;
}

export interface DrugUsageDimRow {
  key: string;
  label: string;
  value: number;
  qty: number;
  order_count: number;
  vn_count: number;
}

export interface DrugUsageTotals {
  value: number;
  qty: number;
  order_count: number;
  drug_count: number;
  vn_count: number;
  hn_count: number;
  opd_value: number;
  ipd_value: number;
}

export interface DrugUsageDashboardData {
  updatedAt: string;
  start: string;
  end: string;
  totals: DrugUsageTotals;
  drugs: DrugUsageDrugRow[];
  trend: DrugUsageTrendRow[];
  departments: DrugUsageDimRow[];
  prescribers: DrugUsageDimRow[];
  rights: DrugUsageDimRow[];
}

// ─── DB rows ──────────────────────────────────────────────────────────────────
interface TotalRow extends RowDataPacket {
  value: number;
  qty: number;
  order_count: number;
  drug_count: number;
  vn_count: number;
  hn_count: number;
  opd_value: number;
  ipd_value: number;
}
interface DrugDbRow extends RowDataPacket {
  icode: string;
  name: string;
  strength: string;
  units: string;
  order_count: number;
  qty: number;
  vn_count: number;
  hn_count: number;
  value: number;
  opd_value: number;
  ipd_value: number;
}
interface TrendDbRow extends RowDataPacket {
  date: string;
  value: number;
  qty: number;
  vn_count: number;
}
interface DimDbRow extends RowDataPacket {
  key: string;
  label: string;
  value: number;
  qty: number;
  order_count: number;
  vn_count: number;
}

// จำนวนรายการยาสูงสุดที่ส่งกลับ (กัน payload บวมกรณีเลือกช่วงยาว ๆ) —
// เรียงตามมูลค่าแล้ว รายการที่ตัดทิ้งจึงเป็นรายการมูลค่าน้อยที่สุด
const MAX_DRUG_ROWS = 2000;
const MAX_DIM_ROWS = 30;

const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => String(v ?? "").trim();

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function getDrugUsageDashboard(
  start: string,
  end: string,
): Promise<DrugUsageDashboardData> {
  const [drugCols, opCols] = await Promise.all([
    tableColumns("drugitems"),
    tableColumns("opitemrece"),
  ]);

  const strengthExpr = optionalCol(drugCols, "d", "strength", "''");
  const unitsExpr = optionalCol(drugCols, "d", "units", "''");

  // IPD = บรรทัดที่ผูกกับ AN (admit), นอกนั้นเป็น OPD
  const hasAn = opCols.has("an");
  const ipdValue = hasAn
    ? `SUM(CASE WHEN COALESCE(o.an, '') <> '' THEN COALESCE(o.sum_price, 0) ELSE 0 END)`
    : "0";
  const opdValue = hasAn
    ? `SUM(CASE WHEN COALESCE(o.an, '') = '' THEN COALESCE(o.sum_price, 0) ELSE 0 END)`
    : `SUM(COALESCE(o.sum_price, 0))`;

  const FROM_DRUG_LINES = `
    FROM opitemrece o
    INNER JOIN drugitems d ON d.icode = o.icode
    WHERE o.vstdate BETWEEN ? AND ?`;

  const range = [start, end];

  const [
    [totalRows],
    [drugRows],
    [trendRows],
    [deptRows],
    [prescriberRows],
    [rightRows],
  ] = await Promise.all([
    // 1) ยอดรวมทั้งสถานบริการ
    db.query<TotalRow[]>(
      `
      SELECT
        SUM(COALESCE(o.sum_price, 0))  AS value,
        SUM(COALESCE(o.qty, 0))        AS qty,
        COUNT(*)                       AS order_count,
        COUNT(DISTINCT o.icode)        AS drug_count,
        COUNT(DISTINCT o.vn)           AS vn_count,
        COUNT(DISTINCT o.hn)           AS hn_count,
        ${opdValue}                    AS opd_value,
        ${ipdValue}                    AS ipd_value
      ${FROM_DRUG_LINES}
      `,
      range,
    ),

    // 2) รายการยา เรียงตามมูลค่าการใช้ (หัวใจของรายงาน)
    db.query<DrugDbRow[]>(
      `
      SELECT
        o.icode                                  AS icode,
        COALESCE(NULLIF(d.name, ''), o.icode)    AS name,
        ${strengthExpr}                          AS strength,
        ${unitsExpr}                             AS units,
        COUNT(*)                                 AS order_count,
        SUM(COALESCE(o.qty, 0))                  AS qty,
        COUNT(DISTINCT o.vn)                     AS vn_count,
        COUNT(DISTINCT o.hn)                     AS hn_count,
        SUM(COALESCE(o.sum_price, 0))            AS value,
        ${opdValue}                              AS opd_value,
        ${ipdValue}                              AS ipd_value
      ${FROM_DRUG_LINES}
      GROUP BY o.icode
      ORDER BY value DESC
      LIMIT ${MAX_DRUG_ROWS}
      `,
      range,
    ),

    // 3) แนวโน้มรายวัน
    db.query<TrendDbRow[]>(
      `
      SELECT
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS date,
        SUM(COALESCE(o.sum_price, 0))      AS value,
        SUM(COALESCE(o.qty, 0))            AS qty,
        COUNT(DISTINCT o.vn)               AS vn_count
      ${FROM_DRUG_LINES}
      GROUP BY o.vstdate
      ORDER BY o.vstdate
      `,
      range,
    ),

    // 4) แยกตามแผนกที่รับบริการ (main_dep ของ visit)
    db.query<DimDbRow[]>(
      `
      SELECT
        COALESCE(NULLIF(ov.main_dep, ''), '-')          AS \`key\`,
        COALESCE(NULLIF(k.department, ''), 'ไม่ระบุแผนก') AS label,
        SUM(COALESCE(o.sum_price, 0))                   AS value,
        SUM(COALESCE(o.qty, 0))                         AS qty,
        COUNT(*)                                        AS order_count,
        COUNT(DISTINCT o.vn)                            AS vn_count
      FROM opitemrece o
      INNER JOIN drugitems d      ON d.icode = o.icode
      LEFT  JOIN ovst ov          ON ov.vn = o.vn
      LEFT  JOIN kskdepartment k  ON k.depcode = ov.main_dep
      WHERE o.vstdate BETWEEN ? AND ?
      GROUP BY \`key\`, label
      ORDER BY value DESC
      LIMIT ${MAX_DIM_ROWS}
      `,
      range,
    ),

    // 5) แยกตามผู้สั่งใช้
    db.query<DimDbRow[]>(
      `
      SELECT
        COALESCE(NULLIF(o.doctor, ''), '-')                       AS \`key\`,
        COALESCE(NULLIF(dr.name, ''), NULLIF(o.doctor, ''), 'ไม่ระบุผู้สั่ง') AS label,
        SUM(COALESCE(o.sum_price, 0))                             AS value,
        SUM(COALESCE(o.qty, 0))                                   AS qty,
        COUNT(*)                                                  AS order_count,
        COUNT(DISTINCT o.vn)                                      AS vn_count
      FROM opitemrece o
      INNER JOIN drugitems d ON d.icode = o.icode
      LEFT  JOIN doctor dr   ON dr.code = o.doctor
      WHERE o.vstdate BETWEEN ? AND ?
      GROUP BY \`key\`, label
      ORDER BY value DESC
      LIMIT ${MAX_DIM_ROWS}
      `,
      range,
    ),

    // 6) แยกตามสิทธิ์การรักษา
    db.query<DimDbRow[]>(
      `
      SELECT
        COALESCE(NULLIF(v.pttype, ''), '-')          AS \`key\`,
        COALESCE(NULLIF(p.name, ''), 'ไม่ระบุสิทธิ์') AS label,
        SUM(COALESCE(o.sum_price, 0))                AS value,
        SUM(COALESCE(o.qty, 0))                      AS qty,
        COUNT(*)                                     AS order_count,
        COUNT(DISTINCT o.vn)                         AS vn_count
      FROM opitemrece o
      INNER JOIN drugitems d ON d.icode = o.icode
      LEFT  JOIN vn_stat v   ON v.vn = o.vn
      LEFT  JOIN pttype p    ON p.pttype = v.pttype
      WHERE o.vstdate BETWEEN ? AND ?
      GROUP BY \`key\`, label
      ORDER BY value DESC
      LIMIT ${MAX_DIM_ROWS}
      `,
      range,
    ),
  ]);

  const t = totalRows[0];
  const totals: DrugUsageTotals = {
    value: num(t?.value),
    qty: num(t?.qty),
    order_count: num(t?.order_count),
    drug_count: num(t?.drug_count),
    vn_count: num(t?.vn_count),
    hn_count: num(t?.hn_count),
    opd_value: num(t?.opd_value),
    ipd_value: num(t?.ipd_value),
  };

  const toDim = (r: DimDbRow): DrugUsageDimRow => ({
    key: str(r.key),
    label: str(r.label) || "ไม่ระบุ",
    value: num(r.value),
    qty: num(r.qty),
    order_count: num(r.order_count),
    vn_count: num(r.vn_count),
  });

  return {
    updatedAt: new Date().toISOString(),
    start,
    end,
    totals,
    drugs: drugRows.map((r) => ({
      icode: str(r.icode),
      name: str(r.name),
      strength: str(r.strength),
      units: str(r.units),
      order_count: num(r.order_count),
      qty: num(r.qty),
      vn_count: num(r.vn_count),
      hn_count: num(r.hn_count),
      value: num(r.value),
      opd_value: num(r.opd_value),
      ipd_value: num(r.ipd_value),
    })),
    trend: trendRows.map((r) => ({
      date: str(r.date),
      value: num(r.value),
      qty: num(r.qty),
      vn_count: num(r.vn_count),
    })),
    departments: deptRows.map(toDim),
    prescribers: prescriberRows.map(toDim),
    rights: rightRows.map(toDim),
  };
}
