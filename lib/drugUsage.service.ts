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

export type ItemKind =
  | "drug"      // เวชภัณฑ์ยาทั้งหมด
  | "herbal"    // ยาสมุนไพร (ชุดย่อยของยา)
  | "lab"       // ตรวจทางห้องปฏิบัติการ
  | "supply"    // วัสดุสิ้นเปลือง (nondrugitems หมวด 05)
  | "service"   // ค่าบริการ/หัตถการ (nondrugitems หมวดอื่น)
  | "nondrug";  // ชื่อเดิมของ supply — คงไว้ให้ลิงก์เก่าใช้ได้

const envList = (v: string | undefined): string[] =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

// ── การกรองหมวดค่าใช้จ่าย มี 2 ชั้น คนละคอลัมน์กัน อย่าสับสน ──────────────────
//   itemIncome → d.income  บน "ตารางทะเบียนเวชภัณฑ์" (drugitems/nondrugitems/lab_items)
//                = หมวดที่ตั้งไว้ให้ตัวเวชภัณฑ์นั้น ๆ  ← ตัวที่รายงานจริงใช้
//                nondrug default '05' = เวชภัณฑ์ที่มิใช่ยา
//                env: DRUG_USAGE_NONDRUG_ITEM_INCOME (และ _DRUG_ / _LAB_ ตามชนิด)
//   income     → o.income  บน opitemrece = หมวดที่บันทึกลงรายการค่าใช้จ่ายรายบรรทัด
//                default ไม่กรอง เพราะจะซ้ำกับ itemIncome และทำให้ยอดหาย
//                env: DRUG_USAGE_NONDRUG_INCOME (และ _DRUG_ / _LAB_ ตามชนิด)
// ทั้งคู่ใส่หลายค่าคั่นด้วย , ได้ เช่น "05,06" · ปล่อยว่าง = ไม่กรองชั้นนั้น
const KIND_CONFIG: Record<
  ItemKind,
  {
    table: "drugitems" | "nondrugitems" | "lab_items";
    label: string;
    /** ชื่อคอลัมน์ชื่อรายการ — ไล่ตามลำดับ ใช้ตัวแรกที่มีอยู่จริง */
    nameCols: string[];
    /** กรองด้วย d.income บนตารางทะเบียนเวชภัณฑ์ (เอาเฉพาะรหัสเหล่านี้) */
    itemIncome: string[];
    /** กรองด้วย d.income แบบตัดออก (เอาทุกอย่าง ยกเว้นรหัสเหล่านี้) */
    itemIncomeNot?: string[];
    /** true = เพิ่มเงื่อนไข "เป็นยาสมุนไพร" */
    herbalOnly?: boolean;
    /** "supply" = เอาเฉพาะวัสดุสิ้นเปลืองจริง, "service" = เอาเฉพาะค่าบริการ/หัตถการ */
    nondrugSplit?: "supply" | "service";
    /** กรองด้วย o.income บน opitemrece */
    income: string[];
  }
> = {
  drug: {
    table: "drugitems",
    label: "เวชภัณฑ์ยา",
    nameCols: ["name"],
    itemIncome: envList(process.env.DRUG_USAGE_DRUG_ITEM_INCOME),
    income: envList(process.env.DRUG_USAGE_DRUG_INCOME),
  },
  herbal: {
    table: "drugitems",
    label: "ยาสมุนไพร",
    nameCols: ["name"],
    itemIncome: envList(process.env.DRUG_USAGE_HERBAL_ITEM_INCOME),
    herbalOnly: true,
    income: envList(process.env.DRUG_USAGE_HERBAL_INCOME),
  },
  lab: {
    table: "lab_items",
    label: "ตรวจทางห้องปฏิบัติการ",
    nameCols: ["lab_items_name", "name"],
    itemIncome: envList(process.env.DRUG_USAGE_LAB_ITEM_INCOME),
    income: envList(process.env.DRUG_USAGE_LAB_INCOME),
  },
  // วัสดุสิ้นเปลืองจริง = nondrugitems หมวด 05 ที่เป็นของจับต้องได้จริง
  supply: {
    table: "nondrugitems",
    label: "วัสดุสิ้นเปลืองจริง",
    nameCols: ["name"],
    itemIncome: envList(process.env.DRUG_USAGE_SUPPLY_ITEM_INCOME ?? "05"),
    nondrugSplit: "supply",
    income: envList(process.env.DRUG_USAGE_SUPPLY_INCOME),
  },
  // ค่าบริการ/หัตถการ = nondrugitems ที่เหลือทั้งหมด (ทุกหมวด)
  service: {
    table: "nondrugitems",
    label: "ค่าบริการ/หัตถการ",
    nameCols: ["name"],
    itemIncome: envList(process.env.DRUG_USAGE_SERVICE_ITEM_INCOME),
    nondrugSplit: "service",
    income: envList(process.env.DRUG_USAGE_SERVICE_INCOME),
  },
  // alias เดิม (ก่อนแยก supply/service) — ชี้ไปที่วัสดุสิ้นเปลืองเหมือนเดิม
  nondrug: {
    table: "nondrugitems",
    label: "เวชภัณฑ์ที่ไม่ใช่ยา",
    nameCols: ["name"],
    itemIncome: envList(process.env.DRUG_USAGE_NONDRUG_ITEM_INCOME ?? "05"),
    income: envList(process.env.DRUG_USAGE_NONDRUG_INCOME),
  },
};

const ITEM_KINDS = [
  "drug",
  "herbal",
  "lab",
  "supply",
  "service",
  "nondrug",
] as const;

export function isItemKind(v: unknown): v is ItemKind {
  return (ITEM_KINDS as readonly unknown[]).includes(v);
}

/** หมวดที่แสดงบนหน้า dashboard (ไม่รวม alias เดิม) */
export const VISIBLE_KINDS: ItemKind[] = [
  "drug",
  "herbal",
  "lab",
  "supply",
  "service",
];

// ── เกณฑ์ "เป็นยาสมุนไพร" บน drugitems ─────────────────────────────────────────
// โครงสร้าง drugitems ต่างกันตามเวอร์ชัน HOSxP → ใช้เท่าที่มีจริง
//   DRUG_USAGE_HERBAL_TYPES    ค่าคอลัมน์ประเภทยาที่ถือเป็นสมุนไพร (default 10)
//   DRUG_USAGE_HERBAL_KEYWORDS คำในชื่อยา (LIKE %คำ%)
const HERBAL_TYPES = envList(process.env.DRUG_USAGE_HERBAL_TYPES ?? "10");
const HERBAL_KEYWORDS = envList(
  process.env.DRUG_USAGE_HERBAL_KEYWORDS ??
    [
      "ฟ้าทะลายโจร", "ขมิ้นชัน", "เพชรสังฆาต", "มะขามแขก", "ชุมเห็ดเทศ",
      "เถาวัลย์เปรียง", "สหัศธารา", "สหัสธารา", "ประสะไพล", "เบญจกูล",
      "ธาตุอบเชย", "ไพล", "ยาหอม", "ตรีผลา", "หญ้าดอกขาว", "บัวบก",
      "ว่านหางจระเข้", "กระชาย", "ขิง", "มะระขี้นก", "สมุนไพร", "รางจืด",
      "มะแว้ง", "พญายอ", "ประคบ", "ศุขไสยาศน์", "ทำลายพระสุเมรุ",
      "แก้ลมแก้เส้น", "แก้ลมเส้น", "ประสะมะแว้ง", "ประสะน้ำนม", "กะเม็ง",
      "พอกเข่า", "มะขามป้อม", "บำรุงน้ำนม", "อบสมุนไพร", "กัญชา",
    ].join(","),
);
// ── แยก "วัสดุสิ้นเปลืองจริง" ออกจาก "ค่าบริการ/หัตถการ" ใน nondrugitems ──
// กฎเดียวกับไฟล์ต้นแบบที่แพทย์ใช้:
//   ชื่อขึ้นต้นด้วย "ค่า"        → ค่าบริการ/หัตถการ (เช่น ค่าห้อง/ค่าอาหาร)
//   หน่วยนับเป็นหน่วยของจริง    → วัสดุสิ้นเปลืองจริง
//   นอกนั้น                     → ค่าบริการ/หัตถการ
const SUPPLY_UNITS = envList(
  process.env.DRUG_USAGE_SUPPLY_UNITS ??
    [
      "ชิ้น", "คู่", "ชุด", "ม้วน", "ถุง", "ขวด", "แผ่น", "หลอด",
      "ซอง", "พับ", "อัน", "ห่อ", "กล่อง", "ผืน", "คัน", "แท่ง",
    ].join(","),
);
const SERVICE_NAME_PREFIX = process.env.DRUG_USAGE_SERVICE_PREFIX ?? "ค่า";

const HERBAL_FLAG_COLS = ["is_herb", "is_herbal", "herbal", "herb", "thai_herb"];
const HERBAL_TYPE_COLS = ["drugtype", "drug_type", "drugitem_type", "drug_group"];

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
  /** ราคาต่อหน่วยจากทะเบียนเวชภัณฑ์ (0 = ไม่มีข้อมูล) */
  price: number;
  /** ราคาต่อหน่วยเฉลี่ยที่คิดจริง = มูลค่ารวม / จำนวนที่จ่าย */
  avg_price: number;
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

/** ยอดรวมของหนึ่งปีงบประมาณ — ใช้ทำตารางเปรียบเทียบย้อนหลังหลายปี */
export interface DrugUsageYearRow {
  fiscal_year: number;
  value: number;
  qty: number;
  order_count: number;
  item_count: number;
  vn_count: number;
  hn_count: number;
  opd_value: number;
  ipd_value: number;
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

/** ความละเอียดของกราฟแนวโน้ม — ช่วงยาวสรุปเป็นรายเดือนให้จุดน้อยลง */
export type TrendUnit = "day" | "month";

/** ส่วนหลักของหน้า — โหลดก่อน เรนเดอร์ได้ทันที */
export interface DrugUsageCoreData {
  updatedAt: string;
  kind: ItemKind;
  kindLabel: string;
  start: string;
  end: string;
  trendUnit: TrendUnit;
  /** ปีงบประมาณ พ.ศ. ทั้งหมดที่มีข้อมูลในช่วงนี้ (มาก → น้อย) */
  fiscalYears: number[];
  /** ยอดรวมแยกรายปีงบ (ใหม่ → เก่า) สำหรับตารางเปรียบเทียบ */
  byYear: DrugUsageYearRow[];
  totals: DrugUsageTotals;
  items: DrugUsageItemRow[];
  /** จำนวนแถวสูงสุดที่ query นี้ยอมส่งกลับ */
  itemsLimit: number;
  /** true = มีรายการมูลค่าน้อยถูกตัดออกด้วย LIMIT (ยอดในตารางจะน้อยกว่า totals) */
  itemsTruncated: boolean;
  trend: DrugUsageTrendRow[];
}

/** ส่วนแยกมิติ — โหลดตามหลัง เพราะต้อง join ตารางใหญ่ */
export interface DrugUsageDimsData {
  departments: DrugUsageDimRow[];
  prescribers: DrugUsageDimRow[];
  rights: DrugUsageDimRow[];
}

export type DrugUsageDashboardData = DrugUsageCoreData & DrugUsageDimsData;

// ─── DB rows ──────────────────────────────────────────────────────────────────
interface ItemDbRow extends RowDataPacket {
  icode: string;
  price: number;
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
interface YearDbRow extends RowDataPacket {
  fiscal_year: number | null;
  value: number;
  qty: number;
  order_count: number;
  item_count: number;
  vn_count: number;
  hn_count: number;
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
// ช่วงหลายปีงบจะแตกเป็นแถวละปี → ขยายเพดานตามจำนวนปี แต่ไม่เกิน 6000 แถว
const MAX_ITEM_ROWS = 2000;
function itemRowLimit(start: string, end: string): number {
  const years = Math.max(
    1,
    Math.ceil((Date.parse(end) - Date.parse(start)) / 86_400_000 / 365),
  );
  return Math.min(6000, MAX_ITEM_ROWS + 800 * (years - 1));
}
const MAX_DIM_ROWS = 30;

const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => String(v ?? "").trim();
// ─── ตัวช่วย: ประกอบ SQL ส่วนที่ใช้ร่วมกันทุก query ────────────────────────────
interface QueryCtx {
  cfg: (typeof KIND_CONFIG)[ItemKind];
  nameExpr: string;
  strengthExpr: string;
  unitsExpr: string;
  opdValue: string;
  ipdValue: string;
  priceExpr: string;
  where: string;
  from: string;
  params: (string | number)[];
}

async function buildCtx(
  start: string,
  end: string,
  kind: ItemKind,
): Promise<QueryCtx> {
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
  // ราคาต่อหน่วยจากทะเบียน — drugitems/nondrugitems ใช้ price, บางเวอร์ชันใช้ unitprice
  const priceExpr = firstCol(itemCols, "d", ["price", "unitprice"], "0");

  // IPD = บรรทัดที่ผูกกับ AN (admit), นอกนั้นเป็น OPD
  const hasAn = opCols.has("an");
  const ipdValue = hasAn
    ? `SUM(CASE WHEN COALESCE(o.an, '') <> '' THEN COALESCE(o.sum_price, 0) ELSE 0 END)`
    : "0";
  const opdValue = hasAn
    ? `SUM(CASE WHEN COALESCE(o.an, '') = '' THEN COALESCE(o.sum_price, 0) ELSE 0 END)`
    : `SUM(COALESCE(o.sum_price, 0))`;

  // กรองหมวดค่าใช้จ่าย — ใช้เฉพาะชั้นที่ตั้งค่าไว้ และคอลัมน์มีอยู่จริงเท่านั้น
  const params: (string | number)[] = [start, end];
  let incomeSql = "";

  // ชั้นที่ 1: d.income บนตารางทะเบียนเวชภัณฑ์ (ตัวหลักของรายงาน)
  if (cfg.itemIncome.length > 0 && itemCols.has("income")) {
    incomeSql += ` AND d.income IN (${cfg.itemIncome.map(() => "?").join(",")})`;
    params.push(...cfg.itemIncome);
  }
  // แยกวัสดุจริง / ค่าบริการ ตามหน่วยนับ + ชื่อขึ้นต้น "ค่า"
  if (cfg.nondrugSplit) {
    const unitCol = ["unit", "units"].find((cName) => itemCols.has(cName));
    // เงื่อนไข "เป็นวัสดุจริง": ชื่อไม่ขึ้นต้นด้วย ค่า และหน่วยอยู่ในรายการหน่วยของจริง
    const isSupply =
      unitCol && SUPPLY_UNITS.length
        ? `(COALESCE(d.name, '') NOT LIKE ? AND TRIM(COALESCE(d.${unitCol}, '')) IN (${SUPPLY_UNITS.map(
            () => "?",
          ).join(",")}))`
        : `(COALESCE(d.name, '') NOT LIKE ?)`;
    incomeSql += cfg.nondrugSplit === "supply" ? ` AND ${isSupply}` : ` AND NOT ${isSupply}`;
    params.push(`${SERVICE_NAME_PREFIX}%`);
    if (unitCol && SUPPLY_UNITS.length) params.push(...SUPPLY_UNITS);
  }

  // ตัดหมวดออก (ใช้กับค่าบริการ/หัตถการ = ทุกหมวดยกเว้น 05)
  if (cfg.itemIncomeNot?.length && itemCols.has("income")) {
    incomeSql += ` AND COALESCE(d.income, '') NOT IN (${cfg.itemIncomeNot
      .map(() => "?")
      .join(",")})`;
    params.push(...cfg.itemIncomeNot);
  }

  // เฉพาะยาสมุนไพร — ใช้คอลัมน์ flag/ประเภทเท่าที่ตารางนั้นมีจริง + คำในชื่อยา
  if (cfg.herbalOnly) {
    const parts: string[] = [];
    for (const col of HERBAL_FLAG_COLS) {
      if (itemCols.has(col)) parts.push(`(d.${col} = 'Y' OR d.${col} = 1)`);
    }
    const typeCol = HERBAL_TYPE_COLS.find((cName) => itemCols.has(cName));
    if (typeCol && HERBAL_TYPES.length) {
      parts.push(`d.${typeCol} IN (${HERBAL_TYPES.map(() => "?").join(",")})`);
      params.push(...HERBAL_TYPES);
    }
    if (HERBAL_KEYWORDS.length) {
      parts.push(`(${HERBAL_KEYWORDS.map(() => "d.name LIKE ?").join(" OR ")})`);
      params.push(...HERBAL_KEYWORDS.map((k) => `%${k}%`));
    }
    incomeSql += parts.length ? ` AND (${parts.join(" OR ")})` : " AND 1=0";
  }

  // ชั้นที่ 2: o.income บน opitemrece (ปิดไว้เป็นค่าเริ่มต้น)
  if (cfg.income.length > 0 && opCols.has("income")) {
    incomeSql += ` AND o.income IN (${cfg.income.map(() => "?").join(",")})`;
    params.push(...cfg.income);
  }

  const where = `WHERE o.vstdate BETWEEN ? AND ?${incomeSql}`;
  return {
    cfg,
    nameExpr,
    strengthExpr,
    unitsExpr,
    priceExpr,
    opdValue,
    ipdValue,
    where,
    params,
    from: `
    FROM opitemrece o
    INNER JOIN ${cfg.table} d ON d.icode = o.icode
    ${where}`,
  };
}

/** ช่วงยาว ๆ สรุปเป็นรายเดือนแทนรายวัน — จุดบนกราฟน้อยลงมาก payload/เรนเดอร์เบาลง */
function trendUnitFor(start: string, end: string): TrendUnit {
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
  return days > 92 ? "month" : "day";
}

// ─── ส่วนหลักของหน้า: totals + byYear + items + trend (3 query) ────────────────
export async function getDrugUsageCore(
  start: string,
  end: string,
  kind: ItemKind = "drug",
): Promise<DrugUsageCoreData> {
  const c = await buildCtx(start, end, kind);
  const trendUnit = trendUnitFor(start, end);
  const itemsLimit = itemRowLimit(start, end);
  const trendExpr =
    trendUnit === "month"
      ? `DATE_FORMAT(o.vstdate, '%Y-%m-01')`
      : `DATE_FORMAT(o.vstdate, '%Y-%m-%d')`;

  const [[yearRows], [itemRows], [trendRows]] = await Promise.all([
    // 1) ยอดรวมรายปีงบ + ยอดรวมทั้งหมดในคราวเดียว (WITH ROLLUP → แถวสรุปท้ายสุด)
    //    ประหยัดการสแกน opitemrece ไป 1 รอบเทียบกับแยก query totals
    db.query<YearDbRow[]>(
      `
      SELECT
        ${FY_EXPR}                     AS fiscal_year,
        SUM(COALESCE(o.sum_price, 0))  AS value,
        SUM(COALESCE(o.qty, 0))        AS qty,
        COUNT(*)                       AS order_count,
        COUNT(DISTINCT o.icode)        AS item_count,
        COUNT(DISTINCT o.vn)           AS vn_count,
        COUNT(DISTINCT o.hn)           AS hn_count,
        ${c.opdValue}                  AS opd_value,
        ${c.ipdValue}                  AS ipd_value
      ${c.from}
      GROUP BY fiscal_year WITH ROLLUP
      `,
      c.params,
    ),

    // 2) รายการเวชภัณฑ์ เรียงตามมูลค่าการใช้ (หัวใจของรายงาน)
    db.query<ItemDbRow[]>(
      `
      SELECT
        o.icode                                  AS icode,
        ${FY_EXPR}                               AS fiscal_year,
        ${c.nameExpr}                            AS name,
        MAX(${c.priceExpr})                      AS price,
        ${c.strengthExpr}                        AS strength,
        ${c.unitsExpr}                           AS units,
        COUNT(*)                                 AS order_count,
        SUM(COALESCE(o.qty, 0))                  AS qty,
        COUNT(DISTINCT o.vn)                     AS vn_count,
        COUNT(DISTINCT o.hn)                     AS hn_count,
        SUM(COALESCE(o.sum_price, 0))            AS value,
        ${c.opdValue}                            AS opd_value,
        ${c.ipdValue}                            AS ipd_value
      ${c.from}
      GROUP BY o.icode, fiscal_year
      ORDER BY value DESC
      LIMIT ${itemsLimit}
      `,
      c.params,
    ),

    // 3) แนวโน้ม — รายวัน (ช่วงสั้น) หรือรายเดือน (ช่วงยาว)
    db.query<TrendDbRow[]>(
      `
      SELECT
        ${trendExpr}                       AS date,
        SUM(COALESCE(o.sum_price, 0))      AS value,
        SUM(COALESCE(o.qty, 0))            AS qty,
        COUNT(DISTINCT o.vn)               AS vn_count
      ${c.from}
      GROUP BY date
      ORDER BY date
      `,
      c.params,
    ),
  ]);

  // แถว ROLLUP (fiscal_year เป็น NULL) = ยอดรวมทั้งช่วง — แยกออกจากแถวรายปี
  const rollup = yearRows.find((r) => r.fiscal_year === null);
  const byYear: DrugUsageYearRow[] = yearRows
    .filter((r) => r.fiscal_year !== null)
    .map((r) => ({
      fiscal_year: num(r.fiscal_year),
      value: num(r.value),
      qty: num(r.qty),
      order_count: num(r.order_count),
      item_count: num(r.item_count),
      vn_count: num(r.vn_count),
      hn_count: num(r.hn_count),
      opd_value: num(r.opd_value),
      ipd_value: num(r.ipd_value),
    }))
    .sort((a, b) => b.fiscal_year - a.fiscal_year);

  // ไม่มีแถว ROLLUP (บาง engine) → รวมจากรายปีแทน (distinct จะเป็นค่าประมาณสูงสุด)
  const totals: DrugUsageTotals = rollup
    ? {
        value: num(rollup.value),
        qty: num(rollup.qty),
        order_count: num(rollup.order_count),
        item_count: num(rollup.item_count),
        vn_count: num(rollup.vn_count),
        hn_count: num(rollup.hn_count),
        opd_value: num(rollup.opd_value),
        ipd_value: num(rollup.ipd_value),
      }
    : byYear.reduce(
        (a, y) => ({
          value: a.value + y.value,
          qty: a.qty + y.qty,
          order_count: a.order_count + y.order_count,
          item_count: Math.max(a.item_count, y.item_count),
          vn_count: a.vn_count + y.vn_count,
          hn_count: Math.max(a.hn_count, y.hn_count),
          opd_value: a.opd_value + y.opd_value,
          ipd_value: a.ipd_value + y.ipd_value,
        }),
        {
          value: 0, qty: 0, order_count: 0, item_count: 0,
          vn_count: 0, hn_count: 0, opd_value: 0, ipd_value: 0,
        },
      );

  return {
    updatedAt: new Date().toISOString(),
    kind,
    kindLabel: c.cfg.label,
    start,
    end,
    trendUnit,
    fiscalYears: byYear.map((y) => y.fiscal_year).filter(Boolean),
    byYear,
    totals,
    itemsLimit,
    itemsTruncated: itemRows.length >= itemsLimit,
    items: itemRows.map((r) => {
      const qty = num(r.qty);
      const value = num(r.value);
      return {
      icode: str(r.icode),
      price: num(r.price),
      avg_price: qty > 0 ? value / qty : num(r.price),
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
      };
    }),
    trend: trendRows.map((r) => ({
      date: str(r.date),
      value: num(r.value),
      qty: num(r.qty),
      vn_count: num(r.vn_count),
    })),
  };
}

// ─── ส่วนแยกมิติ: แผนก / ผู้สั่งใช้ / สิทธิ์ (3 query) ─────────────────────────
// โหลดทีหลังจากส่วนหลัก เพราะ 2 ใน 3 ต้อง join ตารางใหญ่ (ovst / vn_stat)
export async function getDrugUsageDims(
  start: string,
  end: string,
  kind: ItemKind = "drug",
): Promise<DrugUsageDimsData> {
  const c = await buildCtx(start, end, kind);

  // '-' คือคีย์แทน "ไม่มีค่า" ที่ SQL ใส่ให้ — อย่าปล่อยหลุดไปเป็นป้ายชื่อบนกราฟ
  const UNKNOWN_KEYS = new Set(["", "-"]);
  const toDim = (r: DimDbRow): DrugUsageDimRow => ({
    key: str(r.key),
    label: str(r.label) || "ไม่ระบุ",
    value: num(r.value),
    qty: num(r.qty),
    order_count: num(r.order_count),
    vn_count: num(r.vn_count),
  });

  const [[deptRows], [prescriberRows], [rightRows]] = await Promise.all([
    // แยกตามแผนกที่รับบริการ (main_dep ของ visit)
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
      INNER JOIN ${c.cfg.table} d ON d.icode = o.icode
      LEFT  JOIN ovst ov          ON ov.vn = o.vn
      LEFT  JOIN kskdepartment k  ON k.depcode = ov.main_dep
      ${c.where}
      GROUP BY \`key\`, label
      ORDER BY value DESC
      LIMIT ${MAX_DIM_ROWS}
      `,
      c.params,
    ),

    // แยกตามผู้สั่งใช้ — o.doctor อยู่บน opitemrece อยู่แล้ว ไม่ต้อง join ตาราง doctor
    // (ชื่อผู้สั่งค่อยดึงทีหลังด้วย query เล็ก ๆ ตามรหัสที่ได้จริง ≤ MAX_DIM_ROWS แถว)
    db.query<DimDbRow[]>(
      `
      SELECT
        COALESCE(NULLIF(o.doctor, ''), '-')  AS \`key\`,
        ''                                   AS label,
        SUM(COALESCE(o.sum_price, 0))        AS value,
        SUM(COALESCE(o.qty, 0))              AS qty,
        COUNT(*)                             AS order_count,
        COUNT(DISTINCT o.vn)                 AS vn_count
      ${c.from}
      GROUP BY \`key\`
      ORDER BY value DESC
      LIMIT ${MAX_DIM_ROWS}
      `,
      c.params,
    ),

    // แยกตามสิทธิ์การรักษา
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
      INNER JOIN ${c.cfg.table} d ON d.icode = o.icode
      LEFT  JOIN vn_stat v      ON v.vn = o.vn
      LEFT  JOIN pttype p       ON p.pttype = v.pttype
      ${c.where}
      GROUP BY \`key\`, label
      ORDER BY value DESC
      LIMIT ${MAX_DIM_ROWS}
      `,
      c.params,
    ),
  ]);

  // เติมชื่อผู้สั่งใช้จากรหัสที่ได้ (query เล็ก คิดเป็นภาระแทบเป็นศูนย์)
  const prescribers = prescriberRows.map(toDim);
  const codes = prescribers.map((r) => r.key).filter((k) => !UNKNOWN_KEYS.has(k));
  let nameOf = new Map<string, string>();
  if (codes.length) {
    try {
      const [names] = await db.query<RowDataPacket[]>(
        `SELECT code, name FROM doctor WHERE code IN (${codes.map(() => "?").join(",")})`,
        codes,
      );
      nameOf = new Map(names.map((n) => [str(n.code), str(n.name)]));
    } catch {
      // ดึงชื่อไม่ได้ → ใช้รหัสผู้สั่งเป็นป้ายแทน
    }
  }
  for (const r of prescribers) {
    r.label = UNKNOWN_KEYS.has(r.key)
      ? "ไม่ระบุผู้สั่ง"
      : nameOf.get(r.key) || r.key;
  }

  const fixLabel = (rows: DrugUsageDimRow[], unknown: string) =>
    rows.map((r) =>
      UNKNOWN_KEYS.has(r.label) || UNKNOWN_KEYS.has(r.key) && r.label === r.key
        ? { ...r, label: unknown }
        : r,
    );

  return {
    departments: fixLabel(deptRows.map(toDim), "ไม่ระบุแผนก"),
    prescribers,
    rights: fixLabel(rightRows.map(toDim), "ไม่ระบุสิทธิ์"),
  };
}

// ─── สรุปงบประมาณรวมข้ามชนิด (ยา / ไม่ใช่ยา / Lab) — query เบา ๆ ชนิดละ 1 รอบ ────
export interface DrugUsageKindTotal {
  kind: ItemKind;
  label: string;
  value: number;
  qty: number;
  order_count: number;
  item_count: number;
  opd_value: number;
  ipd_value: number;
}
export interface DrugUsageSummaryData {
  start: string;
  end: string;
  kinds: DrugUsageKindTotal[];
}

interface KindTotalRow extends RowDataPacket {
  value: number;
  qty: number;
  order_count: number;
  item_count: number;
  opd_value: number;
  ipd_value: number;
}

export async function getDrugUsageSummary(
  start: string,
  end: string,
): Promise<DrugUsageSummaryData> {
  const kinds = VISIBLE_KINDS;
  const results = await Promise.all(
    kinds.map(async (kind): Promise<DrugUsageKindTotal> => {
      const label = KIND_CONFIG[kind].label;
      try {
        const c = await buildCtx(start, end, kind);
        const [rows] = await db.query<KindTotalRow[]>(
          `
          SELECT
            SUM(COALESCE(o.sum_price, 0)) AS value,
            SUM(COALESCE(o.qty, 0))       AS qty,
            COUNT(*)                      AS order_count,
            COUNT(DISTINCT o.icode)       AS item_count,
            ${c.opdValue}                 AS opd_value,
            ${c.ipdValue}                 AS ipd_value
          ${c.from}
          `,
          c.params,
        );
        const r = rows[0];
        return {
          kind,
          label,
          value: num(r?.value),
          qty: num(r?.qty),
          order_count: num(r?.order_count),
          item_count: num(r?.item_count),
          opd_value: num(r?.opd_value),
          ipd_value: num(r?.ipd_value),
        };
      } catch {
        // บางโรงพยาบาลอาจไม่มีตาราง lab_items — อย่าให้ทั้งการ์ดพัง
        return {
          kind, label, value: 0, qty: 0, order_count: 0,
          item_count: 0, opd_value: 0, ipd_value: 0,
        };
      }
    }),
  );
  return { start, end, kinds: results };
}

/** ทั้งหน้าในครั้งเดียว — ใช้กับ cache warmer / ผู้เรียกที่อยากได้ครบทีเดียว */
export async function getDrugUsageDashboard(
  start: string,
  end: string,
  kind: ItemKind = "drug",
): Promise<DrugUsageDashboardData> {
  const [core, dims] = await Promise.all([
    getDrugUsageCore(start, end, kind),
    getDrugUsageDims(start, end, kind),
  ]);
  return { ...core, ...dims };
}
