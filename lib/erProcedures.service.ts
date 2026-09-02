// lib/erProcedures.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// รายงาน "การทำหัตถการที่ห้อง ER"
//
// ที่มาของข้อมูล (query ต้นฉบับที่ใช้ตรวจสอบหน้างาน):
//   select concat(p.pname," ",p.fname," ",p.lname) as pname, er.vstdate, oo.icode,
//          op.name as opname, d.name, op.er_oper_code
//     from er_regist_oper inp
//     left outer join opitemrece oo   on oo.vn    = inp.vn
//     left outer join er_oper_code op on op.icode = oo.icode
//     left outer join patient p       on p.hn     = oo.hn
//     left outer join er_regist er    on er.vn    = inp.vn
//     inner join doctor d             on d.code   = inp.doctor
//    where er.vstdate between ? and ? and oo.icode in ('3140260')
//    group by oo.vn order by oo.vstdate
//
// ปรับจากต้นฉบับ 3 จุด (ตัวเลขจึงอาจต่างจาก query เดิมเล็กน้อย — ตั้งใจ):
//   1) ต้นฉบับตั้ง er_regist_oper เป็นตารางหลักแล้ว join opitemrece ด้วย vn เฉย ๆ
//      → visit ที่ลงหัตถการไว้หลายรายการจะได้แถวซ้ำเท่าจำนวนหัตถการที่ลง
//      (ต้นฉบับกลบด้วย group by oo.vn ซึ่งทำให้เลือกหัตถการหลายตัวพร้อมกันไม่ได้
//       เพราะ vn เดียวเหลือแถวเดียว) → ที่นี่ตั้ง opitemrece เป็นตารางหลัก
//      และ group by vn + icode = "1 หัตถการ ต่อ 1 visit นับ 1 ครั้ง"
//   2) ต้นฉบับ inner join doctor → visit ที่ไม่ได้ระบุแพทย์/รหัสแพทย์ไม่มีในทะเบียน
//      จะหายไปทั้งแถว → ที่นี่ใช้ left join แล้วแสดง "ไม่ระบุ" แทน (ข้อมูลไม่หาย)
//   3) ชื่อแพทย์ไล่หาตามลำดับ: er_regist_oper ของหัตถการตัวนั้น → er_regist_oper
//      ของ visit นั้น → ผู้ลงค่าบริการใน opitemrece → แพทย์เจ้าของ visit ใน ovst
//
// นิยาม "หัตถการที่ทำที่ห้อง ER" ที่ใช้ในไฟล์นี้:
//   รายการค่าบริการ (opitemrece) ที่ icode อยู่ในทะเบียนหัตถการ ER (er_oper_code)
//   และ visit นั้นเป็น visit ห้องฉุกเฉิน (มีแถวใน er_regist)
//   วันที่ที่ใช้รายงาน = er_regist.vstdate (วันที่มารับบริการที่ ER)
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

// ─── Types ────────────────────────────────────────────────────────────────────

/** 1 รายการในทะเบียนหัตถการ ER (ตาราง er_oper_code) — ใช้เป็นตัวเลือกใน filter */
export interface ErProcedureCatalogItem {
  icode: string;
  /** รหัสหัตถการของ ER (er_oper_code.er_oper_code) */
  operCode: string;
  name: string;
  /** จำนวนครั้งที่พบในช่วงวันที่ที่ขอ (0 = มีในทะเบียนแต่ไม่ได้ทำในช่วงนี้) */
  count: number;
}

/** 1 แถวรายงาน = 1 หัตถการ ที่ทำใน 1 visit */
export interface ErProcedureRow {
  vn: string;
  hn: string;
  /** วันที่มารับบริการที่ ER (YYYY-MM-DD) */
  vstdate: string;
  vsttime: string;
  icode: string;
  operCode: string;
  procedureName: string;
  patientName: string;
  age: number;
  /** '1' = ชาย */
  sex: string;
  pttypeName: string;
  doctorName: string;
  /** จำนวนหน่วยที่คิดค่าบริการ (ปกติ 1) */
  qty: number;
  /** มูลค่ารวมของรายการนั้นใน visit */
  sumPrice: number;
}

export interface ErProcedureSummaryItem {
  icode: string;
  operCode: string;
  name: string;
  /** จำนวนครั้ง (นับ 1 หัตถการ ต่อ 1 visit) */
  count: number;
  /** จำนวนผู้รับบริการ (นับ HN ไม่ซ้ำ) */
  patients: number;
  qty: number;
  sumPrice: number;
}

export interface ErProceduresData {
  updatedAt: string;
  start: string;
  end: string;
  /** ทะเบียนหัตถการ ER ทั้งหมด (พร้อมยอดในช่วงที่ขอ) — ตัวเลือกของ filter */
  catalog: ErProcedureCatalogItem[];
  rows: ErProcedureRow[];
  summary: {
    /** จำนวนครั้งทั้งหมด */
    total: number;
    /** จำนวน visit ที่มีหัตถการ (vn ไม่ซ้ำ) */
    visits: number;
    /** จำนวนผู้รับบริการ (hn ไม่ซ้ำ) */
    patients: number;
    /** จำนวนชนิดหัตถการที่ทำจริงในช่วงนี้ */
    procedureTypes: number;
    qty: number;
    sumPrice: number;
    byProcedure: ErProcedureSummaryItem[];
    byMonth: { month: string; count: number }[];
    byDoctor: { name: string; count: number }[];
  };
}

interface CatalogQueryRow extends RowDataPacket {
  icode: string;
  oper_code: string | number | null;
  name: string | null;
}

interface DetailQueryRow extends RowDataPacket {
  vn: string;
  hn: string;
  vstdate: string | Date;
  vsttime: string | null;
  icode: string;
  oper_code: string | number | null;
  procedure_name: string | null;
  patient_name: string | null;
  age: number | null;
  sex: string | null;
  pttype_name: string | null;
  doctor_name: string | null;
  qty: number | string | null;
  sum_price: number | string | null;
}

// ─── SQL ──────────────────────────────────────────────────────────────────────

// ทะเบียนหัตถการ ER — รวมให้เหลือ 1 แถวต่อ 1 icode ก่อนเสมอ
// (ถ้าทะเบียนมี icode ซ้ำ แล้ว join ตรง ๆ ยอด SUM(qty) จะถูกคูณจำนวนแถวที่ซ้ำ)
const ER_OPER_MASTER = `
  SELECT eo.icode                 AS icode,
         MIN(eo.er_oper_code)     AS oper_code,
         MIN(eo.name)             AS name
    FROM er_oper_code eo
   WHERE eo.icode IS NOT NULL AND eo.icode <> ''
   GROUP BY eo.icode`;

/** ชื่อแพทย์/ผู้ทำหัตถการ — ไล่จากที่เจาะจงที่สุดไปหากว้างที่สุด */
const DOCTOR_NAME_EXPR = `
  COALESCE(
    NULLIF((SELECT GROUP_CONCAT(DISTINCT d1.name ORDER BY d1.name SEPARATOR ', ')
              FROM er_regist_oper ero1
              JOIN doctor d1 ON d1.code = ero1.doctor
             WHERE ero1.vn = oo.vn
               AND ero1.er_oper_code = op.oper_code), ''),
    NULLIF((SELECT GROUP_CONCAT(DISTINCT d2.name ORDER BY d2.name SEPARATOR ', ')
              FROM er_regist_oper ero2
              JOIN doctor d2 ON d2.code = ero2.doctor
             WHERE ero2.vn = oo.vn), ''),
    NULLIF(dop.name, ''),
    NULLIF(dv.name, ''),
    'ไม่ระบุ'
  )`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** DATE/DATETIME จาก mysql2 → "YYYY-MM-DD" */
function dateKey(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) {
    return [
      v.getFullYear(),
      String(v.getMonth() + 1).padStart(2, "0"),
      String(v.getDate()).padStart(2, "0"),
    ].join("-");
  }
  return String(v).slice(0, 10);
}

/** ปีงบประมาณปัจจุบัน (1 ต.ค. – 30 ก.ย.) ใน timezone Asia/Bangkok */
export function defaultFiscalRange(): { start: string; end: string } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const fyStartYear = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: `${fyStartYear}-10-01`, end: `${fyStartYear + 1}-09-30` };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * @param start  วันที่เริ่ม (YYYY-MM-DD) — เทียบกับ er_regist.vstdate
 * @param end    วันที่สิ้นสุด (YYYY-MM-DD) รวมวันนั้นด้วย
 * @param icodes กรองเฉพาะหัตถการที่ระบุ (ว่าง = ทุกหัตถการในทะเบียน)
 */
export async function getErProcedures(
  start: string,
  end: string,
  icodes: string[] = [],
): Promise<ErProceduresData> {
  // icode มาจากผู้ใช้ → ผูกเป็น placeholder เสมอ ห้ามต่อ string ลง SQL
  const icodeFilter = icodes.length
    ? `AND oo.icode IN (${icodes.map(() => "?").join(",")})`
    : "";

  const [catalogRaw, detailRaw] = await Promise.all([
    // (A) ทะเบียนหัตถการ ER ทั้งหมด — ใช้เป็นตัวเลือกใน filter ฝั่งหน้าเว็บ
    //     ดึงทั้งทะเบียนเสมอ (ไม่ผูกกับช่วงวันที่) เพื่อให้เลือกหัตถการที่
    //     "ช่วงนี้ยังไม่มีใครทำ" ได้ด้วย — ยอด 0 ก็เป็นข้อมูลของรายงาน
    db.query<CatalogQueryRow[]>(`${ER_OPER_MASTER} ORDER BY name`),

    // (B) รายการหัตถการที่ทำจริง
    db.query<DetailQueryRow[]>(
      `
      SELECT
        oo.vn                                        AS vn,
        oo.hn                                        AS hn,
        DATE(er.vstdate)                             AS vstdate,
        COALESCE(o.vsttime, '')                      AS vsttime,
        oo.icode                                     AS icode,
        op.oper_code                                 AS oper_code,
        COALESCE(NULLIF(op.name, ''), oo.icode)      AS procedure_name,
        TRIM(CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ',
                    COALESCE(p.lname, '')))          AS patient_name,
        COALESCE(v.age_y, 0)                         AS age,
        COALESCE(p.sex, '')                          AS sex,
        COALESCE(ptt.name, '')                       AS pttype_name,
        ${DOCTOR_NAME_EXPR}                          AS doctor_name,
        COALESCE(SUM(oo.qty), 0)                     AS qty,
        COALESCE(SUM(oo.sum_price), 0)               AS sum_price
      FROM opitemrece oo
      INNER JOIN (${ER_OPER_MASTER}) op ON op.icode = oo.icode
      INNER JOIN er_regist er           ON er.vn    = oo.vn
      LEFT  JOIN ovst o                 ON o.vn     = oo.vn
      LEFT  JOIN patient p              ON p.hn     = oo.hn
      LEFT  JOIN vn_stat v              ON v.vn     = oo.vn
      LEFT  JOIN pttype ptt             ON ptt.pttype = v.pttype
      LEFT  JOIN doctor dop             ON dop.code = oo.doctor
      LEFT  JOIN doctor dv              ON dv.code  = o.doctor
      WHERE er.vstdate BETWEEN ? AND ?
        ${icodeFilter}
      GROUP BY oo.vn, oo.icode
      ORDER BY er.vstdate DESC, o.vsttime DESC
      `,
      [start, end, ...icodes],
    ),
  ]);

  const rows: ErProcedureRow[] = detailRaw[0].map((r) => ({
    vn: String(r.vn ?? ""),
    hn: String(r.hn ?? ""),
    vstdate: dateKey(r.vstdate),
    vsttime: String(r.vsttime ?? "").slice(0, 5),
    icode: String(r.icode ?? ""),
    operCode: r.oper_code == null ? "" : String(r.oper_code),
    procedureName: (r.procedure_name ?? "").trim() || String(r.icode ?? ""),
    patientName: (r.patient_name ?? "").trim(),
    age: toNum(r.age),
    sex: String(r.sex ?? ""),
    pttypeName: (r.pttype_name ?? "").trim(),
    doctorName: (r.doctor_name ?? "").trim() || "ไม่ระบุ",
    qty: toNum(r.qty),
    sumPrice: toNum(r.sum_price),
  }));

  return {
    updatedAt: new Date().toISOString(),
    start,
    end,
    catalog: buildCatalog(catalogRaw[0], rows),
    rows,
    summary: buildSummary(rows),
  };
}

/** ทะเบียนหัตถการ + ยอดที่ทำจริงในช่วงนี้ (เรียงมากไปน้อย แล้วตามชื่อ) */
function buildCatalog(
  master: CatalogQueryRow[],
  rows: ErProcedureRow[],
): ErProcedureCatalogItem[] {
  const count = new Map<string, number>();
  for (const r of rows) count.set(r.icode, (count.get(r.icode) ?? 0) + 1);

  const items: ErProcedureCatalogItem[] = master.map((m) => ({
    icode: String(m.icode),
    operCode: m.oper_code == null ? "" : String(m.oper_code),
    name: (m.name ?? "").trim() || String(m.icode),
    count: count.get(String(m.icode)) ?? 0,
  }));

  // หัตถการที่มีในข้อมูลแต่ไม่มีในทะเบียน (ทะเบียนถูกลบทีหลัง) — เติมให้เลือกได้ด้วย
  const known = new Set(items.map((i) => i.icode));
  for (const r of rows) {
    if (known.has(r.icode)) continue;
    known.add(r.icode);
    items.push({
      icode: r.icode,
      operCode: r.operCode,
      name: r.procedureName,
      count: count.get(r.icode) ?? 0,
    });
  }

  return items.sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"),
  );
}

function buildSummary(rows: ErProcedureRow[]): ErProceduresData["summary"] {
  const byProc = new Map<
    string,
    ErProcedureSummaryItem & { hnSet: Set<string> }
  >();
  const byMonth = new Map<string, number>();
  const byDoctor = new Map<string, number>();
  const vnSet = new Set<string>();
  const hnSet = new Set<string>();
  let qty = 0;
  let sumPrice = 0;

  for (const r of rows) {
    let p = byProc.get(r.icode);
    if (!p) {
      p = {
        icode: r.icode,
        operCode: r.operCode,
        name: r.procedureName,
        count: 0,
        patients: 0,
        qty: 0,
        sumPrice: 0,
        hnSet: new Set<string>(),
      };
      byProc.set(r.icode, p);
    }
    p.count += 1;
    p.qty += r.qty;
    p.sumPrice += r.sumPrice;
    if (r.hn) p.hnSet.add(r.hn);

    const month = r.vstdate.slice(0, 7);
    if (month) byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    byDoctor.set(r.doctorName, (byDoctor.get(r.doctorName) ?? 0) + 1);

    if (r.vn) vnSet.add(r.vn);
    if (r.hn) hnSet.add(r.hn);
    qty += r.qty;
    sumPrice += r.sumPrice;
  }

  const byProcedure = [...byProc.values()]
    .map(({ hnSet: hs, ...rest }) => ({ ...rest, patients: hs.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));

  return {
    total: rows.length,
    visits: vnSet.size,
    patients: hnSet.size,
    procedureTypes: byProcedure.length,
    qty,
    sumPrice: Math.round(sumPrice * 100) / 100,
    byProcedure,
    byMonth: [...byMonth.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    byDoctor: [...byDoctor.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th")),
  };
}
