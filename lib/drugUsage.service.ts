// lib/drugUsage.service.ts
// สรุปยอดการใช้เวชภัณฑ์ตามมูลค่าการใช้ทั้งหมดในสถานบริการ — ใช้ได้ 2 แบบ
//   kind = "drug"    → เวชภัณฑ์ยา            (opitemrece JOIN drugitems)
//   kind = "nondrug" → เวชภัณฑ์ที่ไม่ใช่ยา   (opitemrece JOIN nondrugitems + income = '05')
//   kind = "lab"     → ตรวจทางห้องปฏิบัติการ (opitemrece JOIN lab_items)
//
// การ inner join กับตารางทะเบียนเวชภัณฑ์ทำให้เหลือเฉพาะรายการเวชภัณฑ์จริง
// (ตัด lab / x-ray / ค่าบริการ ออก)
//
// อ้างอิงจาก query ต้นฉบับที่ใช้ตรวจสอบหน้างาน:
//   -- ยา
//   select d.name, d.strength, d.units, count(distinct vn), sum(qty), sum(o.sum_price)
//     from opitemrece o, drugitems d
//    where o.icode = d.icode and o.vstdate between ? and ?
//    group by d.name, d.strength, d.units order by sum_price desc
//   -- ไม่ใช่ยา
//   select d.unit, d.price, d.name, count(hn), sum(qty), sum(o.sum_price)
//     from opitemrece o left outer join nondrugitems d on d.icode = o.icode
//    where o.icode = d.icode and o.vstdate between ? and ? and o.income = '05'
//    group by d.name order by sum_price desc
//   -- lab
//   select d.icode, d.lab_items_name, count(distinct o.vn), sum(o.qty), sum(o.sum_price)
//     from opitemrece o left outer join lab_items d on d.icode = o.icode
//    where o.icode = d.icode and o.vstdate between ? and ?
//    group by d.lab_items_name order by sum_price desc
//
// โครงสร้างตารางต่างกันตามเวอร์ชัน HOSxP → คอลัมน์ที่ไม่การันตี
// (strength/units/unit/an/income) จะถูกตรวจจาก information_schema ก่อนนำไปประกอบ SQL
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export type ItemKind = "drug" | "nondrug" | "lab";

const envList = (v: string | undefined): string[] =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

// รหัสหมวดค่าใช้จ่าย (opitemrece.income) ที่ถือเป็นเวชภัณฑ์แต่ละแบบ
// - ยา: ไม่กรอง (การ join drugitems เพียงพอแล้ว)
// - ไม่ใช่ยา: '05' = ค่าเวชภัณฑ์ที่มิใช่ยา ตามรายงานต้นฉบับ — ปรับได้ด้วย env
const KIND_CONFIG: Record<
  ItemKind,
  {
    table: "drugitems" | "nondrugitems" | "lab_items";
    label: string;
    /** ชื่อคอลัมน์ชื่อรายการ — ไล่ตามลำดับ ใช้ตัวแรกที่มีอยู่จริง */
    nameCols: string[];
    income: string[];
  }
> = {
  drug: {
    table: "drugitems",
    label: "เวชภัณฑ์ยา",
    nameCols: ["name"],
    income: envList(process.env.DRUG_USAGE_DRUG_INCOME),
  },
  nondrug: {
    table: "nondrugitems",
    label: "เวชภัณฑ์ที่ไม่ใช่ยา",
    nameCols: ["name"],
    income: envList(process.env.DRUG_USAGE_NONDRUG_INCOME ?? "05"),
  },
  lab: {
    table: "lab_items",
    label: "ตรวจทางห้องปฏิบัติการ",
    nameCols: ["lab_items_name", "name"],
    income: envList(process.env.DRUG_USAGE_LAB_INCOME),
  },
};

export function isItemKind(v: unknown): v is ItemKind {
  return v === "drug" || v === "nondrug" || v === "lab";
}

// ปีงบประมาณไทย (พ.ศ.) — เริ่ม 1 ต.ค. เช่น 1 ต.ค. 2025 (2568) = ปีงบ 2569
const FY_EXPR = `(YEAR(o.vstdate) + 543 + IF(MONTH(o.vstdate) >= 10, 1, 0))`;

/** "YYYY-MM-DD" → ปีงบประมาณ พ.ศ. */
export function fiscalYearOf(isoDate: string): number {
  const [y, m] = String(isoDate).slice(0, 10).split("-").map(Number);
  if (!y || !m) return 0;
  return y + 543 + (m >= 10 ? 1 : 0);
}

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

/**
 * คอลัมน์ที่ "อาจไม่มี" → คืน expression ที่ปลอดภัย
 * ชื่อคอลัมน์ที่ส่งเข้ามาเป็น literal ในโค้ดนี้เท่านั้น (ไม่ใช่ input ผู้ใช้)
 * และยังต้องมีอยู่จริงใน information_schema จึงจะถูกต่อลง SQL
 */
function firstCol(
  cols: Set<string>,
  alias: string,
  candidates: string[],
  fallback = "''",
): string {
  const col = candidates.find((c) => cols.has(c));
  return col ? `COALESCE(${alias}.${col}, ${fallback})` : fallback;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DrugUsageItemRow {
  icode: string;
  /** ปีงบประมาณ พ.ศ. ของยอดแถวนี้ — แยกแถวเมื่อช่วงข้อมูลคร่อมหลายปีงบ */
  fiscal_year: number;
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
  item_count: number;
  vn_count: number;
  hn_count: number;
  opd_value: number;
  ipd_value: number;
}

export interface DrugUsageDashboardData {
  updatedAt: string;
  kind: ItemKind;
  kindLabel: string;
  start: string;
  end: string;
  /** ปีงบประมาณ พ.ศ. ทั้งหมดที่มีข้อมูลในช่วงนี้ (มาก → น้อย) */
  fiscalYears: number[];
  totals: DrugUsageTotals;
  items: DrugUsageItemRow[];
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
  item_count: number;
  vn_count: number;
  hn_count: number;
  opd_value: number;
  ipd_value: number;
}
interface ItemDbRow extends RowDataPacket {
  icode: string;
  fiscal_year: number;
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

// จำนวนรายการสูงสุดที่ส่งกลับ (กัน payload บวมกรณีเลือกช่วงยาว ๆ) —
// เรียงตามมูลค่าแล้ว รายการที่ตัดทิ้งจึงเป็นรายการมูลค่าน้อยที่สุด
const MAX_ITEM_ROWS = 2000;
const MAX_DIM_ROWS = 30;

const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => String(v ?? "").trim();

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function getDrugUsageDashboard(
  start: string,
  end: string,
  kind: ItemKind = "drug",
): Promise<DrugUsageDashboardData> {
  const cfg = KIND_CONFIG[kind];

  const [itemCols, opCols] = await Promise.all([
    tableColumns(cfg.table),
    tableColumns("opitemrece"),
  ]);

  // drugitems ใช้ strength + units, nondrugitems ใช้ unit (เอกพจน์) และไม่มี strength
  // lab_items ใช้ lab_items_name เป็นชื่อรายการ และไม่มีทั้ง strength/units
  const strengthExpr = firstCol(itemCols, "d", ["strength"]);
  const unitsExpr = firstCol(itemCols, "d", ["units", "unit"]);
  const nameExpr = `COALESCE(NULLIF(${firstCol(itemCols, "d", cfg.nameCols)}, ''), o.icode)`;

  // IPD = บรรทัดที่ผูกกับ AN (admit), นอกนั้นเป็น OPD
  const hasAn = opCols.has("an");
  const ipdValue = hasAn
    ? `SUM(CASE WHEN COALESCE(o.an, '') <> '' THEN COALESCE(o.sum_price, 0) ELSE 0 END)`
    : "0";
  const opdValue = hasAn
    ? `SUM(CASE WHEN COALESCE(o.an, '') = '' THEN COALESCE(o.sum_price, 0) ELSE 0 END)`
    : `SUM(COALESCE(o.sum_price, 0))`;

  // กรองหมวดค่าใช้จ่าย (เฉพาะเมื่อมีคอลัมน์ income จริงและตั้งค่าไว้)
  const useIncome = cfg.income.length > 0 && opCols.has("income");
  const incomeSql = useIncome
    ? ` AND o.income IN (${cfg.income.map(() => "?").join(",")})`
    : "";
  const params = useIncome ? [start, end, ...cfg.income] : [start, end];

  const WHERE = `WHERE o.vstdate BETWEEN ? AND ?${incomeSql}`;
  const FROM_LINES = `
    FROM opitemrece o
    INNER JOIN ${cfg.table} d ON d.icode = o.icode
    ${WHERE}`;

  const [
    [totalRows],
    [itemRows],
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
        COUNT(DISTINCT o.icode)        AS item_count,
        COUNT(DISTINCT o.vn)           AS vn_count,
        COUNT(DISTINCT o.hn)           AS hn_count,
        ${opdValue}                    AS opd_value,
        ${ipdValue}                    AS ipd_value
      ${FROM_LINES}
      `,
      params,
    ),

    // 2) รายการเวชภัณฑ์ เรียงตามมูลค่าการใช้ (หัวใจของรายงาน)
    db.query<ItemDbRow[]>(
      `
      SELECT
        o.icode                                  AS icode,
        ${FY_EXPR}                               AS fiscal_year,
        ${nameExpr}                              AS name,
        ${strengthExpr}                          AS strength,
        ${unitsExpr}                             AS units,
        COUNT(*)                                 AS order_count,
        SUM(COALESCE(o.qty, 0))                  AS qty,
        COUNT(DISTINCT o.vn)                     AS vn_count,
        COUNT(DISTINCT o.hn)                     AS hn_count,
        SUM(COALESCE(o.sum_price, 0))            AS value,
        ${opdValue}                              AS opd_value,
        ${ipdValue}                              AS ipd_value
      ${FROM_LINES}
      GROUP BY o.icode, fiscal_year
      ORDER BY value DESC
      LIMIT ${MAX_ITEM_ROWS}
      `,
      params,
    ),

    // 3) แนวโน้มรายวัน
    db.query<TrendDbRow[]>(
      `
      SELECT
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS date,
        SUM(COALESCE(o.sum_price, 0))      AS value,
        SUM(COALESCE(o.qty, 0))            AS qty,
        COUNT(DISTINCT o.vn)               AS vn_count
      ${FROM_LINES}
      GROUP BY o.vstdate
      ORDER BY o.vstdate
      `,
      params,
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
      INNER JOIN ${cfg.table} d   ON d.icode = o.icode
      LEFT  JOIN ovst ov          ON ov.vn = o.vn
      LEFT  JOIN kskdepartment k  ON k.depcode = ov.main_dep
      ${WHERE}
      GROUP BY \`key\`, label
      ORDER BY value DESC
      LIMIT ${MAX_DIM_ROWS}
      `,
      params,
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
      INNER JOIN ${cfg.table} d ON d.icode = o.icode
      LEFT  JOIN doctor dr      ON dr.code = o.doctor
      ${WHERE}
      GROUP BY \`key\`, label
      ORDER BY value DESC
      LIMIT ${MAX_DIM_ROWS}
      `,
      params,
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
      INNER JOIN ${cfg.table} d ON d.icode = o.icode
      LEFT  JOIN vn_stat v      ON v.vn = o.vn
      LEFT  JOIN pttype p       ON p.pttype = v.pttype
      ${WHERE}
      GROUP BY \`key\`, label
      ORDER BY value DESC
      LIMIT ${MAX_DIM_ROWS}
      `,
      params,
    ),
  ]);

  const t = totalRows[0];
  const totals: DrugUsageTotals = {
    value: num(t?.value),
    qty: num(t?.qty),
    order_count: num(t?.order_count),
    item_count: num(t?.item_count),
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

  // ปีงบที่มีข้อมูลจริง — อ่านจาก trend ซึ่งครอบคลุมทุกวันในช่วง (ไม่ถูก LIMIT ตัด)
  const fiscalYears = [
    ...new Set(trendRows.map((r) => fiscalYearOf(str(r.date))).filter(Boolean)),
  ].sort((a, b) => b - a);

  return {
    updatedAt: new Date().toISOString(),
    kind,
    kindLabel: cfg.label,
    start,
    end,
    fiscalYears,
    totals,
    items: itemRows.map((r) => ({
      icode: str(r.icode),
      fiscal_year: num(r.fiscal_year),
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
