// lib/anc.service.ts
// SQL service สำหรับ Dashboard งานการพยาบาลผู้คลอด (ANC / Maternity)
// แหล่งข้อมูล: ovstdiag (ICD10), person_anc (บัญชี 2), oapp (นัดหมาย), referout (ส่งต่อ),
//             ipt_pregnancy (ห้องคลอด), lab_head/lab_order/lab_items (ผล Lab), vn_stat (รายได้)
//
// ENV ที่เกี่ยวข้อง:
//   ANC_HCT_LAB_CODES=10        // รหัส lab HCT (รพ.พลับพลาชัย = 10)
//   ANC_HB_LAB_CODES=...        // รหัส lab Hb/Hemoglobin (ตั้งให้ตรง master LIS)

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

const ANC_CLINIC_CODES = ["010"]; // แผนก/คลินิกฝากครรภ์
const QUALITY_VISIT_MIN = 8;

const clinicInList = ANC_CLINIC_CODES.map((c) => `'${c}'`).join(",");

// ─── Types ──────────────────────────────────────────────────────────────────
export interface AncSummary {
  pregPersons: number;
  pregVisits: number;
  pregFirst: number;
  pregLater: number;
  referDiag: number;
  us: number;
  upt: number;
  pv: number;
  nipt: number;
  gdma1: number;
  gdma2: number;
  lab: number;
  vacFlu: number;
  vacAp: number;
  vacDt: number;
  riskOther: number;
  bloodTest: number;
  htn: number;
  admittedAfterAnc: number;
  avgAge: number;
  newRegister: number;
  firstAncUnder12wk: number;
  oldAncVisits: number;
  quality8: number;
  age15to19: number; // วัยรุ่น 15–19 ในคนท้องที่มารับบริการช่วงนั้น
  ageUnder15: number; // < 15 ในคนท้องที่มารับบริการช่วงนั้น
  ancActiveTotal: number;
  laborAdmitCount: number;
  referOutCount: number;
}

export interface MissedApptRow extends RowDataPacket {
  hn: string;
  cid: string;
  ptname: string;
  age_y: number;
  nextdate: string;
  clinic: string;
  tel: string;
}

export interface LaborAdmitRow extends RowDataPacket {
  an: string;
  hn: string;
  ptname: string;
  age_y: number;
  regdate: string;
  labor_date: string;
  ga: number;
  alive_child_count: number;
  pttype_name: string;
}

export interface ReferOutRow extends RowDataPacket {
  refer_date: string;
  hn: string;
  ptname: string;
  age_y: number;
  pdx: string;
  pre_diagnosis: string;
  dest_hospital: string;
}

// ─── 1. Summary ─────────────────────────────────────────────────────────────
export async function getAncSummary(
  start: string,
  end: string,
): Promise<AncSummary> {
  // ── 1.1 ICD10 metrics จาก ovstdiag (นับ distinct hn = ราย, distinct vn = ครั้ง) ──
  //        + วัยรุ่นในคนท้องที่มารับบริการช่วงนั้น (อายุ ณ วันมารับบริการ)
  const [[dx]] = await db.query<RowDataPacket[]>(
    `
    SELECT
      COUNT(DISTINCT CASE WHEN od.icd10 IN ('Z340','Z348') THEN od.hn END) AS pregPersons,
      COUNT(DISTINCT CASE WHEN od.icd10 IN ('Z340','Z348') THEN od.vn END) AS pregVisits,
      COUNT(DISTINCT CASE WHEN od.icd10 = 'Z340' THEN od.hn END)           AS pregFirst,
      COUNT(DISTINCT CASE WHEN od.icd10 = 'Z348' THEN od.hn END)           AS pregLater,
      COUNT(DISTINCT CASE WHEN od.icd10 = 'Z019' THEN od.vn END)           AS us,
      COUNT(DISTINCT CASE WHEN od.icd10 = 'Z321' THEN od.vn END)           AS upt,
      COUNT(DISTINCT CASE WHEN od.icd10 = 'Z041' THEN od.vn END)           AS pv,
      COUNT(DISTINCT CASE WHEN od.icd10 = 'Z360' THEN od.vn END)           AS nipt,
      COUNT(DISTINCT CASE WHEN od.icd10 = 'O240' THEN od.hn END)           AS gdma1,
      COUNT(DISTINCT CASE WHEN od.icd10 = 'O241' THEN od.hn END)           AS gdma2,
      COUNT(DISTINCT CASE WHEN od.icd10 IN ('Z017','Z717') THEN od.vn END) AS lab,
      COUNT(DISTINCT CASE WHEN od.icd10 = 'Z251' THEN od.hn END)           AS vacFlu,
      COUNT(DISTINCT CASE WHEN od.icd10 = 'Z237' THEN od.hn END)           AS vacAp,
      COUNT(DISTINCT CASE WHEN od.icd10 IN ('Z235','Z236') THEN od.hn END) AS vacDt,
      COUNT(DISTINCT CASE WHEN od.icd10 = 'Z358' THEN od.hn END)           AS riskOther,
      COUNT(DISTINCT CASE WHEN od.icd10 IN ('Z718','Z017') THEN od.vn END) AS bloodTest,
      COUNT(DISTINCT CASE WHEN od.icd10 >= 'O10' AND od.icd10 < 'O17' THEN od.hn END) AS htn,
      COUNT(DISTINCT CASE WHEN od.icd10 IN ('Z340','Z348')
            AND TIMESTAMPDIFF(YEAR, pt.birthday, od.vstdate) BETWEEN 15 AND 19 THEN od.hn END) AS teen15to19,
      COUNT(DISTINCT CASE WHEN od.icd10 IN ('Z340','Z348')
            AND TIMESTAMPDIFF(YEAR, pt.birthday, od.vstdate) < 15 THEN od.hn END) AS teenUnder15
    FROM ovstdiag od
    INNER JOIN patient pt ON pt.hn = od.hn
    WHERE od.vstdate BETWEEN ? AND ?
    `,
    [start, end],
  );

  // ── 1.2 Refer (ระบุ Diag) ──
  const [[ref]] = await db.query<RowDataPacket[]>(
    `
    SELECT COUNT(DISTINCT r.hn) AS referDiag
    FROM referout r
    WHERE r.refer_date BETWEEN ? AND ?
      AND (r.pdx LIKE 'O%' OR r.pdx LIKE 'Z3%')
    `,
    [start, end],
  );

  // ── 1.3 person_anc (บัญชี 2 ที่ยังไม่คลอด) ──
  const [[anc]] = await db.query<RowDataPacket[]>(
    `
    SELECT
      COUNT(*)                                                          AS ancActiveTotal,
      ROUND(AVG(p.age_y), 1)                                            AS avgAge,
      SUM(CASE WHEN a.service_count >= ? THEN 1 ELSE 0 END)             AS quality8,
      SUM(CASE WHEN TIMESTAMPDIFF(WEEK, a.lmp, a.anc_register_date) < 12
               AND a.lmp IS NOT NULL THEN 1 ELSE 0 END)                 AS firstAncUnder12wk
    FROM person_anc a
    INNER JOIN person p ON p.person_id = a.person_id
    WHERE (a.discharge <> 'Y' OR a.discharge IS NULL)
    `,
    [QUALITY_VISIT_MIN],
  );

  // ── 1.4 รายใหม่ ──
  const [[reg]] = await db.query<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS newRegister
    FROM person_anc a
    WHERE a.anc_register_date BETWEEN ? AND ?
    `,
    [start, end],
  );

  // ── 1.4b รายเก่า (ครั้ง) ──
  const [[oldv]] = await db.query<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS oldAncVisits
    FROM person_anc_service pas
    INNER JOIN person_anc a ON a.person_anc_id = pas.person_anc_id
    WHERE pas.anc_service_date BETWEEN ? AND ?
      AND pas.anc_service_date > a.anc_register_date
    `,
    [start, end],
  );

  // ── 1.5 ฝากครรภ์แล้วได้นอน รพ. ──
  const [[adm]] = await db.query<RowDataPacket[]>(
    `
    SELECT COUNT(DISTINCT a.person_id) AS admittedAfterAnc
    FROM person_anc a
    INNER JOIN person p ON p.person_id = a.person_id
    INNER JOIN patient pt ON pt.cid = p.cid
    INNER JOIN an_stat ast ON ast.hn = pt.hn
    WHERE (a.discharge <> 'Y' OR a.discharge IS NULL)
      AND ast.regdate BETWEEN ? AND ?
    `,
    [start, end],
  );

  // ── 1.6 Admit ห้องคลอด ──
  const [[lab]] = await db.query<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS laborAdmitCount
    FROM ipt_pregnancy ip
    WHERE ip.labor_date BETWEEN ? AND ?
    `,
    [start, end],
  );

  // ── 1.7 ส่งต่อห้องคลอด ──
  const [[ro]] = await db.query<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS referOutCount
    FROM referout r
    WHERE r.refer_date BETWEEN ? AND ?
      AND (r.pdx LIKE 'O%' OR r.pdx LIKE 'Z3%')
    `,
    [start, end],
  );

  const n = (v: unknown) => Number(v ?? 0);
  return {
    pregPersons: n(dx.pregPersons),
    pregVisits: n(dx.pregVisits),
    pregFirst: n(dx.pregFirst),
    pregLater: n(dx.pregLater),
    referDiag: n(ref.referDiag),
    us: n(dx.us),
    upt: n(dx.upt),
    pv: n(dx.pv),
    nipt: n(dx.nipt),
    gdma1: n(dx.gdma1),
    gdma2: n(dx.gdma2),
    lab: n(dx.lab),
    vacFlu: n(dx.vacFlu),
    vacAp: n(dx.vacAp),
    vacDt: n(dx.vacDt),
    riskOther: n(dx.riskOther),
    bloodTest: n(dx.bloodTest),
    htn: n(dx.htn),
    admittedAfterAnc: n(adm.admittedAfterAnc),
    avgAge: n(anc.avgAge),
    newRegister: n(reg.newRegister),
    firstAncUnder12wk: n(anc.firstAncUnder12wk),
    oldAncVisits: n(oldv.oldAncVisits),
    quality8: n(anc.quality8),
    age15to19: n(dx.teen15to19),
    ageUnder15: n(dx.teenUnder15),
    ancActiveTotal: n(anc.ancActiveTotal),
    laborAdmitCount: n(lab.laborAdmitCount),
    referOutCount: n(ro.referOutCount),
  };
}

// ─── 2. ทะเบียนไม่มาตามนัด (17) ───────────────────────────────────────────────
export async function getAncMissedAppts(
  start: string,
  end: string,
): Promise<MissedApptRow[]> {
  const [rows] = await db.query<MissedApptRow[]>(
    `
    SELECT
      o.hn,
      pt.cid,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS ptname,
      TIMESTAMPDIFF(YEAR, pt.birthday, CURDATE()) AS age_y,
      o.nextdate,
      o.clinic,
      pt.hometel AS tel
    FROM oapp o
    INNER JOIN patient pt ON pt.hn = o.hn
    WHERE o.nextdate BETWEEN ? AND ?
      AND o.nextdate < CURDATE()
      AND (o.clinic IN (${clinicInList}) OR o.depcode IN (${clinicInList})
           OR o.hn IN (
             SELECT p.patient_hn FROM person_anc a
             INNER JOIN person p ON p.person_id = a.person_id
             WHERE (a.discharge <> 'Y' OR a.discharge IS NULL)
           ))
      AND NOT EXISTS (
        SELECT 1 FROM ovst v WHERE v.hn = o.hn AND v.vstdate = o.nextdate
      )
    ORDER BY o.nextdate DESC
    `,
    [start, end],
  );
  return rows;
}

// ─── 3. ทะเบียน Admit ห้องคลอด (25) ───────────────────────────────────────────
export async function getAncLaborAdmit(
  start: string,
  end: string,
): Promise<LaborAdmitRow[]> {
  const [rows] = await db.query<LaborAdmitRow[]>(
    `
    SELECT
      i.an,
      i.hn,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS ptname,
      TIMESTAMPDIFF(YEAR, pt.birthday, ip.labor_date) AS age_y,
      ast.regdate,
      ip.labor_date,
      TIMESTAMPDIFF(WEEK, il.lmp, ip.labor_date) AS ga,
      COALESCE(ili_cnt.alive_child_count, 0) AS alive_child_count,
      ptype.name AS pttype_name
    FROM ipt_pregnancy ip
    INNER JOIN ipt i        ON i.an = ip.an
    INNER JOIN an_stat ast  ON ast.an = ip.an
    INNER JOIN patient pt   ON pt.hn = i.hn
    LEFT JOIN ipt_labour il ON il.an = ip.an
    LEFT JOIN pttype ptype  ON ptype.pttype = ast.pttype
    LEFT JOIN (
      SELECT il2.an, SUM(1) AS alive_child_count
      FROM ipt_labour il2
      INNER JOIN ipt_labour_infant inf ON inf.ipt_labour_id = il2.ipt_labour_id
      GROUP BY il2.an
    ) ili_cnt ON ili_cnt.an = ip.an
    WHERE ip.labor_date BETWEEN ? AND ?
    ORDER BY ip.labor_date DESC
    `,
    [start, end],
  );
  return rows;
}

// ─── 4. ทะเบียนส่งต่อห้องคลอด (26) ────────────────────────────────────────────
export async function getAncReferOut(
  start: string,
  end: string,
): Promise<ReferOutRow[]> {
  const [rows] = await db.query<ReferOutRow[]>(
    `
    SELECT
      r.refer_date,
      r.hn,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS ptname,
      TIMESTAMPDIFF(YEAR, pt.birthday, r.refer_date) AS age_y,
      r.pdx,
      r.pre_diagnosis,
      COALESCE(h.name, r.refer_hospcode, '') AS dest_hospital
    FROM referout r
    INNER JOIN patient pt ON pt.hn = r.hn
    LEFT JOIN hospcode h  ON h.hospcode = r.refer_hospcode
    WHERE r.refer_date BETWEEN ? AND ?
      AND (r.pdx LIKE 'O%' OR r.pdx LIKE 'Z3%')
    ORDER BY r.refer_date DESC
    `,
    [start, end],
  );
  return rows;
}

// ════════════════════════════════════════════════════════════════════════════
// ส่วนกลาง: helper รายวัน/รายเดือน + Lab predicates
// ════════════════════════════════════════════════════════════════════════════
const ANC_PREG_ICD = "'Z340','Z348'";
const WEEKDAY_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_MON = [
  "",
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function ymd(d: unknown): string {
  if (d instanceof Date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return String(d).slice(0, 10);
}

export interface AncDayPoint {
  date: string;
  weekday: string;
  value: number;
}
export interface AncMonthPoint {
  month: string;
  label: string;
  value: number;
}
export interface AncSeries {
  total: number;
  byDay: AncDayPoint[];
  byMonth: AncMonthPoint[];
}

// รวมค่ารายวัน/รายเดือนจาก list ของ { date, value } (ใช้ผลบวก)
function buildSeries(rows: { date: string; value: number }[]): AncSeries {
  const dayMap = new Map<string, number>();
  const monMap = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    if (!r.date) continue;
    total += r.value;
    dayMap.set(r.date, (dayMap.get(r.date) ?? 0) + r.value);
    const m = r.date.slice(0, 7);
    monMap.set(m, (monMap.get(m) ?? 0) + r.value);
  }
  const byDay = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      weekday: WEEKDAY_TH[new Date(date + "T00:00:00").getDay()],
      value,
    }));
  const byMonth = [...monMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => {
      const [y, mm] = month.split("-").map(Number);
      return {
        month,
        label: `${TH_MON[mm]} ${String(y + 543).slice(2)}`,
        value,
      };
    });
  return { total, byDay, byMonth };
}

// ─── 5. รายได้ / คนท้องมารับบริการ / ฝากครรภ์รายใหม่ : รายวัน + รายเดือน ──────
export interface AncDailyMonthly {
  revenue: AncSeries; // รายได้ (บาท) จาก visit ฝากครรภ์
  visits: AncSeries; // จำนวนครั้งที่คนท้องมารับบริการ
  newReg: AncSeries; // ฝากครรภ์รายใหม่
}

export async function getAncDailyMonthly(
  start: string,
  end: string,
): Promise<AncDailyMonthly> {
  // visit ฝากครรภ์ (มี dx Z340/Z348) → รายได้ + จำนวนครั้ง
  const [vnRows] = await db.query<RowDataPacket[]>(
    `
    SELECT DATE(v.vstdate) AS d, v.vn, COALESCE(v.income, 0) AS income
    FROM vn_stat v
    WHERE v.vstdate BETWEEN ? AND ?
      AND EXISTS (
        SELECT 1 FROM ovstdiag od
        WHERE od.vn = v.vn AND od.icd10 IN (${ANC_PREG_ICD})
      )
    `,
    [start, end],
  );

  // ฝากครรภ์รายใหม่ตามวันลงทะเบียน
  const [regRows] = await db.query<RowDataPacket[]>(
    `
    SELECT DATE(a.anc_register_date) AS d, COUNT(*) AS c
    FROM person_anc a
    WHERE a.anc_register_date BETWEEN ? AND ?
    GROUP BY DATE(a.anc_register_date)
    `,
    [start, end],
  );

  const revenue = buildSeries(
    vnRows.map((r) => ({
      date: ymd(r.d),
      value: Math.round(Number(r.income) || 0),
    })),
  );
  const visits = buildSeries(vnRows.map((r) => ({ date: ymd(r.d), value: 1 })));
  const newReg = buildSeries(
    regRows.map((r) => ({ date: ymd(r.d), value: Number(r.c) || 0 })),
  );

  return { revenue, visits, newReg };
}

// ─── 6. ภาวะซีด (Lab) : รายวัน + รายเดือน + ทะเบียน ──────────────────────────
// รหัส Lab ตั้งใน .env (แนะนำ):  ANC_HCT_LAB_CODES=10 , ANC_HB_LAB_CODES=...
const ANC_HCT_LAB_CODES = (process.env.ANC_HCT_LAB_CODES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ANC_HB_LAB_CODES = (process.env.ANC_HB_LAB_CODES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const HCT_PREDICATE = ANC_HCT_LAB_CODES.length
  ? `lo.lab_items_code IN (${ANC_HCT_LAB_CODES.map((c) => `'${c}'`).join(",")})`
  : `(li.lab_items_name LIKE '%Hct%' OR li.lab_items_name LIKE '%HCT%'
      OR li.lab_items_name LIKE '%H.C.T%' OR li.lab_items_name LIKE '%ematocrit%')`;

const HB_PREDICATE = ANC_HB_LAB_CODES.length
  ? `lo.lab_items_code IN (${ANC_HB_LAB_CODES.map((c) => `'${c}'`).join(",")})`
  : `((li.lab_items_name LIKE 'Hb%' OR li.lab_items_name LIKE 'Hgb%'
       OR li.lab_items_name LIKE '%emoglobin%')
      AND li.lab_items_name NOT LIKE '%A1c%' AND li.lab_items_name NOT LIKE '%A1C%')`;

export interface AncAnemiaRow {
  date: string;
  hn: string;
  ptname: string;
  age_y: number;
  value: number; // ค่าผล Lab (HCT % หรือ Hb g/dL)
}

export interface AncAnemia {
  total: number; // ราย (distinct HN) ที่ต่ำกว่าเกณฑ์
  totalTested: number; // ราย ที่ตรวจทั้งหมด (ไว้คิด %)
  byDay: AncDayPoint[]; // value = จำนวนครั้ง (distinct VN) ที่ต่ำกว่าเกณฑ์ ต่อวัน
  byMonth: AncMonthPoint[];
  patients: AncAnemiaRow[];
}

async function getAncAnemia(
  start: string,
  end: string,
  predicate: string,
  threshold: number,
): Promise<AncAnemia> {
  const [rows] = await db.query<RowDataPacket[]>(
    `
    SELECT
      DATE(lh.order_date)                        AS d,
      lh.vn,
      lh.hn,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname)  AS ptname,
      TIMESTAMPDIFF(YEAR, pt.birthday, lh.order_date) AS age_y,
      CAST(lo.lab_order_result AS DECIMAL(10,2)) AS val
    FROM lab_head lh
    INNER JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
    LEFT  JOIN lab_items li ON li.lab_items_code = lo.lab_items_code
    INNER JOIN patient pt   ON pt.hn = lh.hn
    WHERE lh.order_date BETWEEN ? AND ?
      AND ${predicate}
      AND lo.lab_order_result REGEXP '^[0-9]+(\\.[0-9]+)?$'
      AND CAST(lo.lab_order_result AS DECIMAL(10,2)) < ${threshold}
      AND EXISTS (
        SELECT 1 FROM ovstdiag od
        WHERE od.vn = lh.vn AND od.icd10 IN (${ANC_PREG_ICD})
      )
    ORDER BY lh.order_date
    `,
    [start, end],
  );

  const [[tested]] = await db.query<RowDataPacket[]>(
    `
    SELECT COUNT(DISTINCT lh.hn) AS c
    FROM lab_head lh
    INNER JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
    LEFT  JOIN lab_items li ON li.lab_items_code = lo.lab_items_code
    WHERE lh.order_date BETWEEN ? AND ?
      AND ${predicate}
      AND lo.lab_order_result REGEXP '^[0-9]+(\\.[0-9]+)?$'
      AND EXISTS (
        SELECT 1 FROM ovstdiag od
        WHERE od.vn = lh.vn AND od.icd10 IN (${ANC_PREG_ICD})
      )
    `,
    [start, end],
  );

  const dayMap = new Map<string, Set<string>>();
  const monMap = new Map<string, Set<string>>();
  const patMap = new Map<string, AncAnemiaRow>();
  const hnSet = new Set<string>();

  for (const r of rows) {
    const date = ymd(r.d);
    const vn = String(r.vn);
    hnSet.add(String(r.hn));

    if (!dayMap.has(date)) dayMap.set(date, new Set());
    dayMap.get(date)!.add(vn);

    const mon = date.slice(0, 7);
    if (!monMap.has(mon)) monMap.set(mon, new Set());
    monMap.get(mon)!.add(vn);

    if (!patMap.has(vn)) {
      patMap.set(vn, {
        date,
        hn: String(r.hn),
        ptname: r.ptname,
        age_y: Number(r.age_y ?? 0),
        value: Number(r.val),
      });
    }
  }

  const byDay = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, set]) => ({
      date,
      weekday: WEEKDAY_TH[new Date(date + "T00:00:00").getDay()],
      value: set.size,
    }));

  const byMonth = [...monMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, set]) => {
      const [y, m] = month.split("-").map(Number);
      return {
        month,
        label: `${TH_MON[m]} ${String(y + 543).slice(2)}`,
        value: set.size,
      };
    });

  const patients = [...patMap.values()].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  return {
    total: hnSet.size,
    totalTested: Number(tested?.c ?? 0),
    byDay,
    byMonth,
    patients,
  };
}

export const getAncAnemiaHct = (start: string, end: string) =>
  getAncAnemia(start, end, HCT_PREDICATE, 33);

export const getAncAnemiaHb = (start: string, end: string) =>
  getAncAnemia(start, end, HB_PREDICATE, 11);
