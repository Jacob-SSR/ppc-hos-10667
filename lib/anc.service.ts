// lib/anc.service.ts
// SQL service สำหรับ Dashboard งานการพยาบาลผู้คลอด (ANC / Maternity)
// แหล่งข้อมูล: ovstdiag (ICD10), person_anc (บัญชี 2), oapp (นัดหมาย), referout (ส่งต่อ), ipt_pregnancy (ห้องคลอด)
//
// หมายเหตุ (ปรับให้ตรงกับ master ของ รพ. ก่อนใช้งานจริง):
//   - ANC_CLINIC_CODES: รหัสคลินิก/แผนกฝากครรภ์ ใน oapp.clinic / o.main_dep  (default ['010'] = ห้องคลอด)
//   - QUALITY_VISIT_MIN: เกณฑ์ฝากครรภ์ครบคุณภาพ (default 8 ครั้ง)
//   - ICD10 ทั้งหมดอ้างอิงตาม spec ใน Dashboard_งานการพยาบาลผู้คลอด.xlsx

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

const ANC_CLINIC_CODES = ["010"]; // แผนก/คลินิกฝากครรภ์
const QUALITY_VISIT_MIN = 8;

const clinicInList = ANC_CLINIC_CODES.map((c) => `'${c}'`).join(",");

// ─── Types ──────────────────────────────────────────────────────────────────
export interface AncSummary {
  // กลุ่ม ICD10 (ovstdiag)
  pregPersons: number; // 1. หญิงตั้งครรภ์ที่มารับบริการ (Z340/Z348) — ราย
  pregVisits: number; //    (ครั้ง)
  pregFirst: number; //    Z340 ครรภ์แรก
  pregLater: number; //    Z348 ครรภ์หลัง
  referDiag: number; // 2. ที่ Refer (ระบุ Diag)
  us: number; // 3. U/S (Z019)
  upt: number; // 4. UPT (Z321)
  pv: number; // 5. ตรวจภายใน PV (Z041)
  nipt: number; // 6. NIPT (Z360)
  gdma1: number; // 7. GDMA I (O240)
  gdma2: number; // 8. GDMA II (O241)
  lab: number; // 9. LAB (Z017,Z717)
  vacFlu: number; // 10. วัคซีนไข้หวัดใหญ่ (Z251)
  vacAp: number; // 11. วัคซีนไอกรน aP (Z237)
  vacDt: number; // 12. วัคซีนบาดทะยัก dT (Z235,Z236)
  riskOther: number; // 13. ภาวะเสี่ยงอื่นๆ (Z358)
  bloodTest: number; // 16. ตรวจเลือด (Z718,Z017)
  htn: number; // 22. ความดันโลหิตสูง (O10–O16)
  // กลุ่ม person_anc (บัญชี 2 ที่ยังไม่คลอด)
  admittedAfterAnc: number; // 14. ฝากครรภ์แล้วได้นอน รพ.
  avgAge: number; // 15. อายุเฉลี่ย
  newRegister: number; // 18. รับบริการฝากครรภ์รายใหม่
  firstAncUnder12wk: number; // 19. ฝากครั้งแรก GA < 12 สัปดาห์
  oldAncVisits: number; // 20. รายเก่า (ครั้ง)
  quality8: number; // 21. ฝากครบ 8 ครั้งคุณภาพ
  age15to19: number; // 23. อายุ 15–19 ปี
  ageUnder15: number; // 24. อายุ < 15 ปี
  ancActiveTotal: number; // รวมหญิงตั้งครรภ์ในบัญชี 2 (ยังไม่คลอด)
  // จำนวนทะเบียน
  laborAdmitCount: number; // 25. Admit ห้องคลอด
  referOutCount: number; // 26. ส่งต่อห้องคลอด
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
      COUNT(DISTINCT CASE WHEN od.icd10 >= 'O10' AND od.icd10 < 'O17' THEN od.hn END) AS htn
    FROM ovstdiag od
    WHERE od.vstdate BETWEEN ? AND ?
    `,
    [start, end],
  );

  // ── 1.2 Refer (ระบุ Diag) — referout ที่ pdx เป็นกลุ่มตั้งครรภ์ (O.. หรือ Z3..) ──
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
      SUM(CASE WHEN p.age_y BETWEEN 15 AND 19 THEN 1 ELSE 0 END)        AS age15to19,
      SUM(CASE WHEN p.age_y < 15 THEN 1 ELSE 0 END)                     AS ageUnder15,
      SUM(CASE WHEN a.service_count >= ? THEN 1 ELSE 0 END)             AS quality8,
      SUM(CASE WHEN TIMESTAMPDIFF(WEEK, a.lmp, a.anc_register_date) < 12
               AND a.lmp IS NOT NULL THEN 1 ELSE 0 END)                 AS firstAncUnder12wk
    FROM person_anc a
    INNER JOIN person p ON p.person_id = a.person_id
    WHERE (a.discharge <> 'Y' OR a.discharge IS NULL)
    `,
    [QUALITY_VISIT_MIN],
  );

  // ── 1.4 รายใหม่ = ลงทะเบียนฝากครรภ์ครั้งแรกของครรภ์ในช่วงเวลา (ไม่อิงวันคลินิก) ──
  // ครอบคลุมทั้งรายใหม่ที่มาวันจันทร์ และที่ปนมาวันพุธ — จับจากเหตุการณ์ลงทะเบียนจริง
  const [[reg]] = await db.query<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS newRegister
    FROM person_anc a
    WHERE a.anc_register_date BETWEEN ? AND ?
    `,
    [start, end],
  );

  // ── 1.4b รายเก่า (ครั้ง) = visit ติดตามในช่วงเวลา (ไม่ใช่ครั้งลงทะเบียน) ──
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

  // ── 1.5 ฝากครรภ์แล้วได้นอน รพ. (บัญชี 2 ยังไม่คลอด → จับกับ an_stat ด้วย cid) ──
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

  // ── 1.6 จำนวนทะเบียน Admit ห้องคลอด (ipt_pregnancy.labor_date) ──
  const [[lab]] = await db.query<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS laborAdmitCount
    FROM ipt_pregnancy ip
    WHERE ip.labor_date BETWEEN ? AND ?
    `,
    [start, end],
  );

  // ── 1.7 จำนวนทะเบียนส่งต่อ ──
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
    age15to19: n(anc.age15to19),
    ageUnder15: n(anc.ageUnder15),
    ancActiveTotal: n(anc.ancActiveTotal),
    laborAdmitCount: n(lab.laborAdmitCount),
    referOutCount: n(ro.referOutCount),
  };
}

// ─── 2. ทะเบียนหญิงตั้งครรภ์ที่ไม่มาตามนัด (17) ───────────────────────────────
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