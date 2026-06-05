import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

// รายการหัตถการเสี่ยงสูง (ICD-9 มาตรฐาน ไม่มีจุด เก็บเลข 0 นำหน้า) + ชื่อหัตถการ
export const HIGH_RISK_PROCEDURES: { code: string; name: string }[] = [
  { code: "9604", name: "Insertion of endotracheal tube" },
  { code: "3404", name: "Insertion of ICD" },
  { code: "3491", name: "Thoracocentesis" },
  { code: "5491", name: "Abdominal Paracentesis" },
  { code: "0331", name: "Spinal Tap / Lumbar Puncture" },
];

const PROC_NAME: Record<string, string> = Object.fromEntries(
  HIGH_RISK_PROCEDURES.map((p) => [p.code, p.name]),
);

// er_oper_code (รหัสท้องถิ่น) ที่ตรงกับ 5 หัตถการเป้าหมาย
const ER_OPER_CODES = [12, 13, 14, 15, 22, 125, 134];

// SQL CASE: er_oper_code → ICD-9 มาตรฐาน
const CASE_ER_OPER = `
  CASE %COL%
    WHEN 12  THEN '0331'
    WHEN 13  THEN '3491'
    WHEN 14  THEN '3404'
    WHEN 15  THEN '5491'
    WHEN 134 THEN '5491'
    WHEN 22  THEN '9604'
    WHEN 125 THEN '9604'
  END`;

// SQL CASE: icd9 ดิบ (อาจมีจุด/0 หน้า) → ICD-9 มาตรฐาน
const CASE_ICD9 = (col: string) => `
  CASE
    WHEN REPLACE(${col},'.','') IN ('0331','331') THEN '0331'
    WHEN REPLACE(${col},'.','') = '3491'          THEN '3491'
    WHEN REPLACE(${col},'.','') = '3404'          THEN '3404'
    WHEN REPLACE(${col},'.','') = '5491'          THEN '5491'
    WHEN REPLACE(${col},'.','') = '9604'          THEN '9604'
  END`;

// เงื่อนไข WHERE match icd9 ดิบ (รวม 0 นำหน้าและกรณีไม่มี 0)
const ICD9_MATCH = (col: string) =>
  `REPLACE(${col},'.','') IN ('9604','3404','3491','5491','0331','331')`;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HrpOpdRow {
  icd9: string;
  procedure_name: string;
  hn: string;
  service_date: string; // วันที่มารับบริการ
  service_time: string;
  patient_name: string;
  age: number;
  sex: string; // '1' = ชาย
  visit_type: "OPD" | "ER";
}

export interface HrpIpdRow {
  icd9: string;
  procedure_name: string;
  hn: string;
  an: string;
  service_date: string; // วันจำหน่าย
  patient_name: string;
  age: number;
  sex: string;
  dchtype_name: string; // ประเภทการจำหน่าย
}

export interface HrpProcedureSummary {
  code: string;
  name: string;
  opd: number;
  ipd: number;
  total: number;
}

export interface HighRiskProceduresData {
  updatedAt: string;
  start: string;
  end: string;
  procedures: { code: string; name: string }[];
  opd: HrpOpdRow[];
  ipd: HrpIpdRow[];
  summary: {
    byProcedure: HrpProcedureSummary[];
    opdTotal: number;
    ipdTotal: number;
    grandTotal: number;
  };
}

interface OpdQueryRow extends RowDataPacket {
  icd9: string;
  vn: string;
  hn: string;
  vstdate: string;
  vsttime: string;
  patient_name: string;
  age: number;
  sex: string;
  is_er: number;
}

interface IpdQueryRow extends RowDataPacket {
  icd9: string;
  hn: string;
  an: string;
  dchdate: string;
  patient_name: string;
  age: number;
  sex: string;
  dchtype_name: string | null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function getHighRiskProcedures(
  start: string,
  end: string,
): Promise<HighRiskProceduresData> {
  // ── (A) ผู้ป่วยนอก/ER จาก doctor_operation (ผูก vn) ──
  //    match จาก er_oper_code หรือ icd9 ดิบ
  const [opdDocRaw] = await db.query<OpdQueryRow[]>(
    `
    SELECT
      COALESCE(${CASE_ER_OPER.replace("%COL%", "dop.er_oper_code")},
               ${CASE_ICD9("dop.icd9")})              AS icd9,
      o.vn                                             AS vn,
      o.hn                                             AS hn,
      DATE(o.vstdate)                                  AS vstdate,
      o.vsttime                                        AS vsttime,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname)        AS patient_name,
      COALESCE(v.age_y, 0)                             AS age,
      COALESCE(pt.sex, '')                             AS sex,
      (er.vn IS NOT NULL)                              AS is_er
    FROM doctor_operation dop
    INNER JOIN ovst o       ON o.vn = dop.vn
    INNER JOIN patient pt   ON pt.hn = o.hn
    LEFT  JOIN vn_stat v    ON v.vn = o.vn
    LEFT  JOIN er_regist er ON er.vn = o.vn
    WHERE o.vstdate BETWEEN ? AND ?
      AND ( dop.er_oper_code IN (${ER_OPER_CODES.join(",")})
            OR ${ICD9_MATCH("dop.icd9")} )
    `,
    [start, end],
  );

  // ── (B) ผู้ป่วยนอก/ER จาก er_regist_oper (ผูก vn) ──
  const [opdErRaw] = await db.query<OpdQueryRow[]>(
    `
    SELECT
      ${CASE_ER_OPER.replace("%COL%", "ero.er_oper_code")}  AS icd9,
      o.vn                                             AS vn,
      o.hn                                             AS hn,
      DATE(o.vstdate)                                  AS vstdate,
      o.vsttime                                        AS vsttime,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname)        AS patient_name,
      COALESCE(v.age_y, 0)                             AS age,
      COALESCE(pt.sex, '')                             AS sex,
      1                                                AS is_er
    FROM er_regist_oper ero
    INNER JOIN ovst o     ON o.vn = ero.vn
    INNER JOIN patient pt ON pt.hn = o.hn
    LEFT  JOIN vn_stat v  ON v.vn = o.vn
    WHERE ero.er_oper_code IN (${ER_OPER_CODES.join(",")})
      AND o.vstdate BETWEEN ? AND ?
    `,
    [start, end],
  );

  // ── (C) ผู้ป่วยใน (IPD) จาก iptoprt (ผูก an) → ipt (วันจำหน่าย/ประเภท) ──
  const [ipdRaw] = await db.query<IpdQueryRow[]>(
    `
    SELECT
      ${CASE_ICD9("io.icd9")}                          AS icd9,
      ipt.hn                                           AS hn,
      io.an                                            AS an,
      DATE(ipt.dchdate)                                AS dchdate,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname)        AS patient_name,
      COALESCE(a.age_y, 0)                             AS age,
      COALESCE(pt.sex, '')                             AS sex,
      dd.name                                          AS dchtype_name
    FROM iptoprt io
    INNER JOIN ipt         ON ipt.an = io.an
    INNER JOIN patient pt  ON pt.hn = ipt.hn
    LEFT  JOIN an_stat a   ON a.an = io.an
    LEFT  JOIN dchtype dd  ON dd.dchtype = ipt.dchtype
    WHERE ${ICD9_MATCH("io.icd9")}
      AND ipt.dchdate BETWEEN ? AND ?
    ORDER BY ipt.dchdate DESC
    `,
    [start, end],
  );

  // ── รวม OPD/ER (A)+(B) แล้ว dedupe กันนับซ้ำ (vn + icd9 + วันที่) ──
  const opdMap = new Map<string, HrpOpdRow>();
  for (const r of [...opdDocRaw, ...opdErRaw]) {
    if (!r.icd9) continue; // กันกรณี CASE คืน NULL
    const key = `${r.vn}|${r.icd9}|${String(r.vstdate ?? "")}`;
    const existing = opdMap.get(key);
    const isEr = Number(r.is_er) === 1;
    if (existing) {
      // ถ้ามีอยู่แล้ว แต่รายการใหม่บอกว่าเป็น ER ให้ปรับเป็น ER
      if (isEr) existing.visit_type = "ER";
      continue;
    }
    opdMap.set(key, {
      icd9: r.icd9,
      procedure_name: PROC_NAME[r.icd9] ?? r.icd9,
      hn: r.hn,
      service_date: String(r.vstdate ?? ""),
      service_time: (r.vsttime ?? "").slice(0, 5),
      patient_name: (r.patient_name ?? "").trim(),
      age: Number(r.age) || 0,
      sex: String(r.sex ?? ""),
      visit_type: isEr ? "ER" : "OPD",
    });
  }
  const opd: HrpOpdRow[] = Array.from(opdMap.values()).sort(
    (a, b) =>
      b.service_date.localeCompare(a.service_date) ||
      b.service_time.localeCompare(a.service_time),
  );

  const ipd: HrpIpdRow[] = ipdRaw
    .filter((r) => r.icd9)
    .map((r) => ({
      icd9: r.icd9,
      procedure_name: PROC_NAME[r.icd9] ?? r.icd9,
      hn: r.hn,
      an: String(r.an ?? ""),
      service_date: String(r.dchdate ?? ""),
      patient_name: (r.patient_name ?? "").trim(),
      age: Number(r.age) || 0,
      sex: String(r.sex ?? ""),
      dchtype_name: (r.dchtype_name ?? "ไม่ระบุ") || "ไม่ระบุ",
    }));

  // ── สรุปรายหัตถการ ──
  const byProcedure: HrpProcedureSummary[] = HIGH_RISK_PROCEDURES.map((p) => {
    const opdN = opd.filter((r) => r.icd9 === p.code).length;
    const ipdN = ipd.filter((r) => r.icd9 === p.code).length;
    return {
      code: p.code,
      name: p.name,
      opd: opdN,
      ipd: ipdN,
      total: opdN + ipdN,
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    start,
    end,
    procedures: HIGH_RISK_PROCEDURES,
    opd,
    ipd,
    summary: {
      byProcedure,
      opdTotal: opd.length,
      ipdTotal: ipd.length,
      grandTotal: opd.length + ipd.length,
    },
  };
}
