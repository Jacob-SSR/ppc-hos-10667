// lib/bloodTransfusion.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// รายงาน "ผู้ป่วยที่ได้รับเลือด (PRC)" — รวม OPD + IPD ในตารางเดียว
//
// นิยาม: หัตถการ ICD-9-CM 9904 (Transfusion of packed cells)
//   - OPD/ER  → doctor_operation (ผูก vn)
//   - IPD     → iptoprt (ผูก an)
//
// วันที่ได้รับเลือด  = วันที่ระบุในหัตถการ 9904 (ไม่มี → ใช้วันที่รับบริการแทน)
// ครั้งที่          = ตาม Extension Code (1 = ครั้งที่ 1, 2 = ครั้งที่ 2 …)
//                    ไม่มี Extension Code → เรียงลำดับตามเวลาภายใน visit/admission
// เวลาสิ้นสุด       = เวลาสิ้นสุดที่บันทึกในหัตถการ
//                    ไม่มี/ผิดปกติ → ประมาณ เวลาเริ่ม + 4 ชม. (เวลาให้เลือดจริงโดยประมาณ)
//
// ชื่อคอลัมน์ Extension Code / เวลาเริ่ม-สิ้นสุด ต่างกันตามเวอร์ชัน HOSxP
// → ตรวจจากตารางจริงผ่าน information_schema แล้วเลือกคอลัมน์ที่มี (ดู COLUMN_CANDIDATES)
// ตรวจผลการเลือกคอลัมน์ได้ที่ /api/blood-transfusion?diag=1
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export const TRANSFUSION_ICD9 = "9904";
/** เวลาให้เลือดโดยประมาณ (นาที) เมื่อไม่มีเวลาสิ้นสุด */
export const DEFAULT_DURATION_MIN = 240;

// ─── Types ────────────────────────────────────────────────────────────────────
export type ServiceType = "OPD" | "IPD";

export interface TransfusionRow {
  /** key ไม่ซ้ำสำหรับ React */
  id: string;
  type: ServiceType;
  hn: string;
  an: string;
  vn: string;
  patientName: string;
  department: string;
  ward: string;
  /** วันที่รับบริการ (OPD = vstdate, IPD = regdate) YYYY-MM-DD */
  serviceDate: string;
  /** วันที่ได้รับเลือด (จากหัตถการ 9904) YYYY-MM-DD */
  transfusionDate: string;
  icd9: string;
  extCode: string;
  /** ครั้งที่ */
  round: number;
  /** HH:mm หรือ "" ถ้าไม่ทราบ */
  startTime: string;
  endTime: string;
  /** นาที (null = คำนวณไม่ได้เพราะไม่มีเวลาเริ่ม) */
  durationMin: number | null;
  /** true = เวลาสิ้นสุดเป็นค่าประมาณ (เริ่ม + 4 ชม.) */
  endEstimated: boolean;
}

export interface BloodTransfusionData {
  updatedAt: string;
  start: string;
  end: string;
  rows: TransfusionRow[];
  summary: {
    total: number;
    opd: number;
    ipd: number;
    patients: number;
    avgDurationMin: number | null;
    estimated: number;
    byDate: { date: string; opd: number; ipd: number }[];
    byDepartment: { name: string; count: number }[];
  };
  /** คอลัมน์ที่ระบบเลือกใช้จริง — ไว้ตรวจสอบกับ HOSxP แต่ละที่ */
  columns: { opd: ResolvedColumns; ipd: ResolvedColumns };
}

export interface ResolvedColumns {
  ext: string | null;
  start: string | null;
  end: string | null;
}

// ─── ตรวจคอลัมน์จริงในฐานข้อมูล ───────────────────────────────────────────────
const EXT_CANDIDATES = ["ext_code", "icd9_ext", "icd9_ext_code", "extension_code", "ext"];

/** คู่ [คอลัมน์ datetime เดี่ยว] หรือ [date, time] เรียงตามความน่าจะเป็น */
const START_CANDIDATES: [string, string?][] = [
  ["begin_date_time"],
  ["begin_datetime"],
  ["start_datetime"],
  ["opdate", "optime"],
  ["begin_date", "begin_time"],
  ["start_date", "start_time"],
  ["oper_date", "oper_time"],
];
const END_CANDIDATES: [string, string?][] = [
  ["end_date_time"],
  ["end_datetime"],
  ["finish_datetime"],
  ["enddate", "endtime"],
  ["end_date", "end_time"],
  ["finish_date", "finish_time"],
];

const columnCache = new Map<string, Set<string>>();

async function tableColumns(table: string): Promise<Set<string>> {
  const hit = columnCache.get(table);
  if (hit) return hit;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT LOWER(COLUMN_NAME) AS c FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  const set = new Set(rows.map((r) => String(r.c)));
  columnCache.set(table, set);
  return set;
}

function pickDateTime(
  cols: Set<string>,
  alias: string,
  candidates: [string, string?][],
): { sql: string; label: string | null } {
  for (const [a, b] of candidates) {
    if (!cols.has(a)) continue;
    if (!b) return { sql: `${alias}.${a}`, label: a };
    if (cols.has(b)) return { sql: `TIMESTAMP(${alias}.${a}, ${alias}.${b})`, label: `${a} + ${b}` };
  }
  return { sql: "NULL", label: null };
}

async function resolveColumns(table: string, alias: string) {
  const cols = await tableColumns(table);
  const ext = EXT_CANDIDATES.find((c) => cols.has(c)) ?? null;
  const start = pickDateTime(cols, alias, START_CANDIDATES);
  const end = pickDateTime(cols, alias, END_CANDIDATES);
  return {
    extSql: ext ? `CAST(${alias}.${ext} AS CHAR)` : "NULL",
    startSql: start.sql,
    endSql: end.sql,
    resolved: { ext, start: start.label, end: end.label } satisfies ResolvedColumns,
  };
}

// ─── SQL ──────────────────────────────────────────────────────────────────────
// เก็บรหัสได้หลายแบบ: 9904 / 99.04 / 9904 + ext ต่อท้าย (เช่น 990401)
const ICD9_MATCH = (col: string) => `REPLACE(${col},'.','') LIKE '${TRANSFUSION_ICD9}%'`;
const DT = (expr: string) => `DATE_FORMAT(${expr}, '%Y-%m-%d %H:%i:%s')`;

interface RawRow extends RowDataPacket {
  type: ServiceType;
  vn: string | null;
  an: string | null;
  hn: string;
  patient_name: string | null;
  department: string | null;
  ward: string | null;
  service_date: string | null;
  icd9: string | null;
  ext_code: string | null;
  start_dt: string | null;
  end_dt: string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function parseDt(v: string | null): Date | null {
  if (!v || v.startsWith("0000")) return null;
  const d = new Date(v.replace(" ", "T") + "Z"); // ถือเป็นเวลาท้องถิ่นแบบ "naive" (UTC ภายใน)
  return Number.isNaN(d.getTime()) ? null : d;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const hm = (d: Date) => d.toISOString().slice(11, 16);

/** ext ที่ใช้ได้: คอลัมน์ ext ก่อน → ไม่มีก็ดูเลขต่อท้ายรหัส 9904xx */
function extOf(r: RawRow): string {
  const raw = (r.ext_code ?? "").trim();
  if (raw) return raw;
  const code = (r.icd9 ?? "").replace(/\./g, "");
  return code.length > TRANSFUSION_ICD9.length ? code.slice(TRANSFUSION_ICD9.length) : "";
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function getBloodTransfusion(start: string, end: string): Promise<BloodTransfusionData> {
  const [opdCols, ipdCols] = await Promise.all([
    resolveColumns("doctor_operation", "dop"),
    resolveColumns("iptoprt", "io"),
  ]);

  // ── OPD / ER ──
  const [opdRaw] = await db.query<RawRow[]>(
    `
    SELECT 'OPD'                                           AS type,
           o.vn                                            AS vn,
           o.an                                            AS an,
           o.hn                                            AS hn,
           CONCAT(pt.pname, pt.fname, ' ', pt.lname)       AS patient_name,
           CASE WHEN er.vn IS NOT NULL THEN 'ER'
                ELSE COALESCE(k.department, sp.name) END   AS department,
           NULL                                            AS ward,
           DATE_FORMAT(o.vstdate, '%Y-%m-%d')              AS service_date,
           dop.icd9                                        AS icd9,
           ${opdCols.extSql}                               AS ext_code,
           ${DT(opdCols.startSql)}                         AS start_dt,
           ${DT(opdCols.endSql)}                           AS end_dt
      FROM doctor_operation dop
     INNER JOIN ovst o           ON o.vn = dop.vn
     INNER JOIN patient pt       ON pt.hn = o.hn
      LEFT JOIN er_regist er     ON er.vn = o.vn
      LEFT JOIN kskdepartment k  ON k.depcode = o.main_dep
      LEFT JOIN spclty sp        ON sp.spclty = o.spclty
     WHERE o.vstdate BETWEEN ? AND ?
       AND ${ICD9_MATCH("dop.icd9")}
    `,
    [start, end],
  );

  // ── IPD ── ช่วง admit ที่คาบเกี่ยวกับช่วงที่ขอ แล้วกรองวันที่ได้รับเลือดอีกชั้นใน JS
  const [ipdRaw] = await db.query<RawRow[]>(
    `
    SELECT 'IPD'                                           AS type,
           NULL                                            AS vn,
           io.an                                           AS an,
           ipt.hn                                          AS hn,
           CONCAT(pt.pname, pt.fname, ' ', pt.lname)       AS patient_name,
           sp.name                                         AS department,
           w.name                                          AS ward,
           DATE_FORMAT(ipt.regdate, '%Y-%m-%d')            AS service_date,
           io.icd9                                         AS icd9,
           ${ipdCols.extSql}                               AS ext_code,
           ${DT(ipdCols.startSql)}                         AS start_dt,
           ${DT(ipdCols.endSql)}                           AS end_dt
      FROM iptoprt io
     INNER JOIN ipt              ON ipt.an = io.an
     INNER JOIN patient pt       ON pt.hn = ipt.hn
      LEFT JOIN spclty sp        ON sp.spclty = ipt.spclty
      LEFT JOIN ward w           ON w.ward = ipt.ward
     WHERE ipt.regdate <= ?
       AND COALESCE(ipt.dchdate, CURDATE()) >= ?
       AND ${ICD9_MATCH("io.icd9")}
    `,
    [end, start],
  );

  // OPD visit ที่ admit แล้วและมี 9904 ใน iptoprt ของ AN เดียวกัน → นับฝั่ง IPD อย่างเดียว
  const ipdAns = new Set(ipdRaw.map((r) => String(r.an)));
  const raws = [
    ...opdRaw.filter((r) => !(r.an && ipdAns.has(String(r.an)))),
    ...ipdRaw,
  ];

  const built = raws.map((r, i) => {
    const s = parseDt(r.start_dt);
    let e = parseDt(r.end_dt);
    // เวลาเริ่มเป็น 00:00 ทั้งที่ไม่มีเวลาสิ้นสุด = บันทึกแค่วันที่ ไม่ถือเป็นเวลาจริง
    const startKnown = !!s && !(hm(s) === "00:00" && !e);
    let endEstimated = false;
    if (startKnown && (!e || e.getTime() <= s!.getTime())) {
      e = new Date(s!.getTime() + DEFAULT_DURATION_MIN * 60_000);
      endEstimated = true;
    }
    const durationMin = startKnown && e ? Math.round((e.getTime() - s!.getTime()) / 60_000) : null;
    const extCode = extOf(r);
    return {
      id: `${r.type}-${r.vn ?? r.an}-${i}`,
      type: r.type,
      hn: String(r.hn ?? ""),
      an: r.an ? String(r.an) : "",
      vn: r.vn ? String(r.vn) : "",
      patientName: r.patient_name ?? "",
      department: r.department ?? "ไม่ระบุ",
      ward: r.ward ?? "",
      serviceDate: r.service_date ?? "",
      transfusionDate: s ? ymd(s) : (r.service_date ?? ""),
      icd9: TRANSFUSION_ICD9,
      extCode,
      round: Number.parseInt(extCode, 10) || 0,
      startTime: startKnown ? hm(s!) : "",
      endTime: startKnown && e ? hm(e) : "",
      durationMin,
      endEstimated,
      _sort: s?.getTime() ?? 0,
    };
  });

  // ไม่มี ext → ไล่ครั้งที่ตามเวลาภายใน visit/admission เดียวกัน
  const groups = new Map<string, typeof built>();
  for (const r of built) {
    const k = `${r.type}|${r.an || r.vn}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  for (const g of groups.values()) {
    g.sort((a, b) => a._sort - b._sort);
    g.forEach((r, idx) => { if (r.round < 1) r.round = idx + 1; });
  }

  const rows: TransfusionRow[] = built
    .filter((r) => r.transfusionDate >= start && r.transfusionDate <= end)
    .sort((a, b) =>
      a.transfusionDate.localeCompare(b.transfusionDate)
      || a.hn.localeCompare(b.hn)
      || a.round - b.round
      || a._sort - b._sort)
    .map(({ _sort, ...r }) => { void _sort; return r; });

  // ── summary ──
  const byDate = new Map<string, { opd: number; ipd: number }>();
  const byDept = new Map<string, number>();
  let durSum = 0;
  let durN = 0;
  for (const r of rows) {
    const d = byDate.get(r.transfusionDate) ?? { opd: 0, ipd: 0 };
    if (r.type === "OPD") d.opd++; else d.ipd++;
    byDate.set(r.transfusionDate, d);
    byDept.set(r.department, (byDept.get(r.department) ?? 0) + 1);
    if (r.durationMin != null) { durSum += r.durationMin; durN++; }
  }

  return {
    updatedAt: new Date().toISOString(),
    start,
    end,
    rows,
    summary: {
      total: rows.length,
      opd: rows.filter((r) => r.type === "OPD").length,
      ipd: rows.filter((r) => r.type === "IPD").length,
      patients: new Set(rows.map((r) => r.hn)).size,
      avgDurationMin: durN ? Math.round(durSum / durN) : null,
      estimated: rows.filter((r) => r.endEstimated).length,
      byDate: [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v })),
      byDepartment: [...byDept.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
    },
    columns: { opd: opdCols.resolved, ipd: ipdCols.resolved },
  };
}

/** โหมดวินิจฉัย: คอลัมน์ทั้งหมดของตารางหัตถการ + ตัวอย่างแถว 9904 ล่าสุด */
export async function bloodTransfusionDiagnostics() {
  columnCache.clear();
  const [opd, ipd] = await Promise.all([tableColumns("doctor_operation"), tableColumns("iptoprt")]);
  const sample = async (sql: string) => {
    try {
      const [rows] = await db.query<RowDataPacket[]>(sql);
      return rows;
    } catch (e) {
      return { error: (e as Error).message };
    }
  };
  return {
    doctor_operation_columns: [...opd],
    iptoprt_columns: [...ipd],
    resolved: {
      opd: (await resolveColumns("doctor_operation", "dop")).resolved,
      ipd: (await resolveColumns("iptoprt", "io")).resolved,
    },
    sample_doctor_operation: await sample(
      `SELECT * FROM doctor_operation dop WHERE ${ICD9_MATCH("dop.icd9")} ORDER BY dop.vn DESC LIMIT 5`,
    ),
    sample_iptoprt: await sample(
      `SELECT * FROM iptoprt io WHERE ${ICD9_MATCH("io.icd9")} ORDER BY io.an DESC LIMIT 5`,
    ),
  };
}
