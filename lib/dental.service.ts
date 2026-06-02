// lib/dental.service.ts
// SQL service สำหรับ Dashboard ทันตกรรม (Dental — ทันตแพทย์ / ทันตาภิบาล)
// คืนข้อมูลครบทั้ง 8 ชุดในคำขอเดียว ให้หน้าเพจ render ได้เลย
//
// แหล่งข้อมูล: ovst (visit + คิว oqueue) + vn_stat (รายได้/สิทธิ์) + patient
//             + doctor + pttype (ชื่อสิทธิ์) + doctor_operation→icd9_sss (หัตถการจริง ICD-9)
//             + opdscreen (อาการสำคัญ cc)
//
// ปรับให้ตรงกับ master ของ รพ. ก่อนใช้จริง:
//   - DENTAL_DEPCODE: รหัสแผนกทันตกรรม (kskdepartment) — รพ.พลับพลาชัย = '019'
//   - แยกทันตแพทย์/ทันตาภิบาล: ชื่อขึ้นต้น "ทพ."/"ทพญ." หรือ position_id ใน DENTIST_POSITION_IDS = ทันตแพทย์
//     ที่เหลือในแผนก = ทันตาภิบาล (เติม override ได้ที่ THERAPIST_DOCTOR_CODES / DENTIST_DOCTOR_CODES)
//   - หัตถการ: ดึงจริงจาก doctor_operation.icd9 (รพ.พลับพลาชัยพบ 163 แถวในแผนกทันต)
//     ชื่อหัตถการ join จาก DENTAL_ICD9_TABLE (default icd9_sss ตามที่ตรวจจริง)
//     ตั้ง DENTAL_ICD9_TABLE=icd9cm ได้ถ้า รพ. อื่นใช้ชุดนั้น

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

const DENTAL_DEPCODE = process.env.DENTAL_DEPCODE ?? "019";
const DISCHARGED_STATUS = ["99", "98"];
const DENTIST_POSITION_IDS = ["2"];
const DENTIST_DOCTOR_CODES: string[] = [];
const THERAPIST_DOCTOR_CODES: string[] = [];

// ตารางชื่อหัตถการ ICD-9 — รพ.พลับพลาชัยตรวจจริงแล้วว่า doctor_operation.icd9 ผูกกับ 'icd9_sss'
// (icd9cm ไม่มีรหัสพวกนี้) จึง default = icd9_sss ; whitelist กัน SQL injection (ใส่ใน SQL ตรง ๆ)
const ICD9_TABLE_WHITELIST = ["icd9cm", "icd9_sss"] as const;
const DENTAL_ICD9_TABLE = ICD9_TABLE_WHITELIST.includes(
  (process.env.DENTAL_ICD9_TABLE ??
    "") as (typeof ICD9_TABLE_WHITELIST)[number],
)
  ? (process.env.DENTAL_ICD9_TABLE as string)
  : "icd9_sss";

// ─── Types ──────────────────────────────────────────────────────────────────
interface VisitRow extends RowDataPacket {
  vn: string;
  hn: string;
  vstdate: string;
  vsttime: string;
  patient_name: string;
  age: number | null;
  doctor_code: string;
  doctor_name: string;
  position_id: string | null;
  total_income: number;
  pttype_name: string;
  pcode: string;
  chief_complaint: string | null;
}
interface ProcRow extends RowDataPacket {
  vn: string;
  procedure_code: string;
  procedure_name: string;
}
interface QueueRow extends RowDataPacket {
  vn: string;
  hn: string;
  patient_name: string;
  doctor_code: string;
  doctor_name: string;
  position_id: string | null;
  visit_time: string;
  chief_complaint: string | null;
}

export type StaffType = "ทันตแพทย์" | "ทันตาภิบาล" | "อื่นๆ";
export type ShiftCode = "wd_am" | "wd_pm" | "wknd" | "off";

export interface DentalSummaryRow {
  doctor_name: string;
  staff_type: StaffType;
  patient_count: number;
  visit_count: number;
  total_income: number;
}
export interface DentalQueueRow {
  vn: string;
  hn: string;
  patient_name: string;
  doctor_name: string;
  staff_type: StaffType;
  visit_time: string;
  chief_complaint: string;
}
export interface DentalProcRow {
  doctor_name: string;
  staff_type: StaffType;
  procedure_code: string;
  procedure_name: string;
  count: number;
}
export interface DentalPttypeRow {
  doctor_name: string;
  staff_type: StaffType;
  pttype_name: string;
  count: number;
}
export interface DentalTrendRow {
  vstdate: string;
  staff_type: StaffType;
  patient_count: number;
  total_income: number;
}
export interface DentalShiftRow {
  shift_code: ShiftCode;
  staff_type: StaffType;
  pttype_name: string;
  patient_count: number;
  visit_count: number;
  total_income: number;
}
export interface DentalIncomeRow {
  doctor_name: string;
  staff_type: StaffType;
  pttype_name: string;
  total_income: number;
  patient_count: number;
  visit_count: number;
}
export interface DentalPatientRow {
  vstdate: string;
  vsttime: string;
  hn: string;
  vn: string;
  patient_name: string;
  age: number | null;
  doctor_name: string;
  staff_type: StaffType;
  pttype_name: string;
  chief_complaint: string;
  procedures: string;
  total_income: number;
}
export interface DentalDashboardData {
  updatedAt: string;
  summary: DentalSummaryRow[];
  queue: DentalQueueRow[];
  procedures: DentalProcRow[];
  pttype: DentalPttypeRow[];
  daily_trend: DentalTrendRow[];
  shift_report: DentalShiftRow[];
  income_by_doctor_pttype: DentalIncomeRow[];
  patient_list: DentalPatientRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const UC_PCODES = ["UC", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AJ", "AK"];
function classifyRight(pcode: string): string {
  const p = (pcode ?? "").trim();
  if (UC_PCODES.includes(p)) return "UC";
  if (p === "A2") return "ข้าราชการ";
  if (p === "A7") return "ประกันสังคม";
  if (p === "A1" || p === "A9") return "จ่ายเอง";
  return "อื่นๆ";
}
function classifyStaff(
  code: string,
  name: string,
  posId: string | null,
): StaffType {
  if (DENTIST_DOCTOR_CODES.includes(code)) return "ทันตแพทย์";
  if (THERAPIST_DOCTOR_CODES.includes(code)) return "ทันตาภิบาล";
  const n = (name ?? "").trim();
  if (n.startsWith("ทพ.") || n.startsWith("ทพญ.")) return "ทันตแพทย์";
  if (posId && DENTIST_POSITION_IDS.includes(String(posId))) return "ทันตแพทย์";
  if (n.startsWith("ทภ.") || n.includes("ทันตาภิบาล")) return "ทันตาภิบาล";
  return "ทันตาภิบาล"; // คนในแผนกทันตกรรมที่ไม่ใช่ทันตแพทย์
}
function classifyShift(vstdate: string, vsttime: string): ShiftCode {
  const dow = new Date(vstdate + "T00:00:00").getDay(); // 0=Sun,6=Sat
  const [h, m] = (vsttime || "00:00").split(":").map(Number);
  const mins = (h || 0) * 60 + (m || 0);
  const inDay = mins >= 8 * 60 + 30 && mins < 16 * 60 + 30;
  const inEve = mins >= 16 * 60 + 30 && mins < 20 * 60 + 30;
  if (dow === 0 || dow === 6) return inDay ? "wknd" : "off";
  if (inDay) return "wd_am";
  if (inEve) return "wd_pm";
  return "off";
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function getDentalDashboard(
  start: string,
  end: string,
): Promise<DentalDashboardData> {
  // 1) visits (1 แถว/visit)
  const [visits] = await db.query<VisitRow[]>(
    `
    SELECT
      o.vn, o.hn, o.vstdate, o.vsttime,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname)        AS patient_name,
      TIMESTAMPDIFF(YEAR, NULLIF(pt.birthday, '0000-00-00'), o.vstdate) AS age,
      o.doctor                                         AS doctor_code,
      COALESCE(d.name, o.doctor)                       AS doctor_name,
      d.position_id                                    AS position_id,
      COALESCE(v.income, 0)                            AS total_income,
      COALESCE(ptt.name, '')                           AS pttype_name,
      COALESCE(v.pcode, '')                            AS pcode,
      (SELECT os.cc FROM opdscreen os WHERE os.vn = o.vn LIMIT 1) AS chief_complaint
    FROM ovst o
    INNER JOIN vn_stat v  ON v.vn  = o.vn
    INNER JOIN patient pt ON pt.hn = o.hn
    LEFT  JOIN doctor d   ON d.code = o.doctor
    LEFT  JOIN pttype ptt ON ptt.pttype = v.pttype
    WHERE o.vstdate BETWEEN ? AND ?
      AND o.main_dep = ?
      AND o.an IS NULL
    ORDER BY o.vstdate, o.vsttime
    `,
    [start, end, DENTAL_DEPCODE],
  );

  // 2) procedures (หัตถการจริง ICD-9 ต่อ visit — จาก doctor_operation)
  const [procs] = await db.query<ProcRow[]>(
    `
    SELECT op.vn,
           op.icd9                                  AS procedure_code,
           COALESCE(NULLIF(ic9.name, ''), op.icd9)  AS procedure_name
    FROM doctor_operation op
    INNER JOIN ovst o ON o.vn = op.vn
    LEFT  JOIN ${DENTAL_ICD9_TABLE} ic9 ON ic9.code = op.icd9
    WHERE o.vstdate BETWEEN ? AND ?
      AND o.main_dep = ?
      AND o.an IS NULL
      AND op.icd9 IS NOT NULL AND op.icd9 <> ''
    `,
    [start, end, DENTAL_DEPCODE],
  );

  // 3) queue (วันนี้)
  const dischargedList = DISCHARGED_STATUS.map((s) => `'${s}'`).join(",");
  const [qrows] = await db.query<QueueRow[]>(
    `
    SELECT
      o.vn, o.hn,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname)        AS patient_name,
      o.doctor                                         AS doctor_code,
      COALESCE(d.name, o.doctor)                       AS doctor_name,
      d.position_id                                    AS position_id,
      o.vsttime                                        AS visit_time,
      (SELECT os.cc FROM opdscreen os WHERE os.vn = o.vn LIMIT 1) AS chief_complaint
    FROM ovst o
    INNER JOIN patient pt ON pt.hn = o.hn
    LEFT  JOIN doctor d   ON d.code = o.doctor
    WHERE o.vstdate = CURDATE()
      AND o.main_dep = ?
      AND o.an IS NULL
      AND (o.ovstost IS NULL OR o.ovstost = '' OR o.ovstost NOT IN (${dischargedList}))
    ORDER BY CAST(o.oqueue AS UNSIGNED), o.vsttime
    `,
    [DENTAL_DEPCODE],
  );

  // ─── enrich visits ───
  type V = {
    vn: string;
    hn: string;
    vstdate: string;
    vsttime: string;
    patient_name: string;
    age: number | null;
    doctor_name: string;
    staff_type: StaffType;
    pttype_name: string;
    pcode: string;
    total_income: number;
    chief_complaint: string;
    shift_code: ShiftCode;
  };
  const V: V[] = visits.map((r) => ({
    vn: r.vn,
    hn: r.hn,
    vstdate:
      typeof r.vstdate === "string"
        ? r.vstdate
        : new Date(r.vstdate).toISOString().slice(0, 10),
    vsttime: (r.vsttime || "").slice(0, 5),
    patient_name: (r.patient_name || "").trim(),
    age: r.age == null ? null : Number(r.age),
    doctor_name: (r.doctor_name || r.doctor_code || "ไม่ระบุ").trim(),
    staff_type: classifyStaff(r.doctor_code, r.doctor_name, r.position_id),
    pttype_name:
      (r.pttype_name && r.pttype_name.trim()) || classifyRight(r.pcode),
    pcode: r.pcode,
    total_income: Number(r.total_income) || 0,
    chief_complaint: (r.chief_complaint || "").trim(),
    shift_code: classifyShift(
      typeof r.vstdate === "string"
        ? r.vstdate
        : new Date(r.vstdate).toISOString().slice(0, 10),
      (r.vsttime || "").slice(0, 5),
    ),
  }));

  // procedures by vn
  const procByVn = new Map<string, ProcRow[]>();
  procs.forEach((p) => {
    const arr = procByVn.get(p.vn) || [];
    arr.push(p);
    procByVn.set(p.vn, arr);
  });

  // ── summary: by doctor ──
  const sumMap = new Map<
    string,
    { staff_type: StaffType; pts: Set<string>; vis: number; inc: number }
  >();
  V.forEach((r) => {
    const k = r.doctor_name;
    if (!sumMap.has(k))
      sumMap.set(k, {
        staff_type: r.staff_type,
        pts: new Set(),
        vis: 0,
        inc: 0,
      });
    const s = sumMap.get(k)!;
    s.pts.add(r.hn);
    s.vis++;
    s.inc += r.total_income;
  });
  const summary: DentalSummaryRow[] = [...sumMap.entries()]
    .map(([doctor_name, s]) => ({
      doctor_name,
      staff_type: s.staff_type,
      patient_count: s.pts.size,
      visit_count: s.vis,
      total_income: s.inc,
    }))
    .sort((a, b) =>
      a.staff_type === b.staff_type
        ? b.visit_count - a.visit_count
        : a.staff_type.localeCompare(b.staff_type, "th"),
    );

  // ── queue ──
  const queue: DentalQueueRow[] = qrows.map((q) => ({
    vn: q.vn,
    hn: q.hn,
    patient_name: (q.patient_name || "").trim(),
    doctor_name: (q.doctor_name || q.doctor_code || "—").trim(),
    staff_type: classifyStaff(q.doctor_code, q.doctor_name, q.position_id),
    visit_time: (q.visit_time || "").slice(0, 5),
    chief_complaint: (q.chief_complaint || "").trim(),
  }));

  // ── procedures: by (doctor, staff, procedure) ──
  // map vn → {doctor_name, staff_type}
  const vnMeta = new Map<
    string,
    { doctor_name: string; staff_type: StaffType }
  >();
  V.forEach((r) =>
    vnMeta.set(r.vn, { doctor_name: r.doctor_name, staff_type: r.staff_type }),
  );
  const procAgg = new Map<string, DentalProcRow>();
  procs.forEach((p) => {
    const meta = vnMeta.get(p.vn);
    if (!meta) return;
    const k = `${meta.doctor_name}|${p.procedure_code}`;
    if (!procAgg.has(k))
      procAgg.set(k, {
        doctor_name: meta.doctor_name,
        staff_type: meta.staff_type,
        procedure_code: p.procedure_code,
        procedure_name: p.procedure_name,
        count: 0,
      });
    procAgg.get(k)!.count++;
  });
  const procedures = [...procAgg.values()].sort((a, b) => b.count - a.count);

  // ── pttype: by (doctor, staff, pttype) — count visits ──
  const ptAgg = new Map<string, DentalPttypeRow>();
  V.forEach((r) => {
    const k = `${r.doctor_name}|${r.pttype_name}`;
    if (!ptAgg.has(k))
      ptAgg.set(k, {
        doctor_name: r.doctor_name,
        staff_type: r.staff_type,
        pttype_name: r.pttype_name,
        count: 0,
      });
    ptAgg.get(k)!.count++;
  });
  const pttype = [...ptAgg.values()].sort((a, b) => b.count - a.count);

  // ── daily_trend: by (date, staff) ──
  const trAgg = new Map<
    string,
    { staff_type: StaffType; pts: Set<string>; inc: number }
  >();
  V.forEach((r) => {
    const k = `${r.vstdate}|${r.staff_type}`;
    if (!trAgg.has(k))
      trAgg.set(k, { staff_type: r.staff_type, pts: new Set(), inc: 0 });
    const t = trAgg.get(k)!;
    t.pts.add(r.hn);
    t.inc += r.total_income;
  });
  const daily_trend: DentalTrendRow[] = [...trAgg.entries()]
    .map(([k, t]) => ({
      vstdate: k.split("|")[0],
      staff_type: t.staff_type,
      patient_count: t.pts.size,
      total_income: t.inc,
    }))
    .sort((a, b) => a.vstdate.localeCompare(b.vstdate));

  // ── shift_report: by (shift, staff, pttype) ──
  const shAgg = new Map<
    string,
    {
      shift_code: ShiftCode;
      staff_type: StaffType;
      pttype_name: string;
      pts: Set<string>;
      vis: number;
      inc: number;
    }
  >();
  V.forEach((r) => {
    const k = `${r.shift_code}|${r.staff_type}|${r.pttype_name}`;
    if (!shAgg.has(k))
      shAgg.set(k, {
        shift_code: r.shift_code,
        staff_type: r.staff_type,
        pttype_name: r.pttype_name,
        pts: new Set(),
        vis: 0,
        inc: 0,
      });
    const s = shAgg.get(k)!;
    s.pts.add(r.hn);
    s.vis++;
    s.inc += r.total_income;
  });
  const shift_report: DentalShiftRow[] = [...shAgg.values()].map((s) => ({
    shift_code: s.shift_code,
    staff_type: s.staff_type,
    pttype_name: s.pttype_name,
    patient_count: s.pts.size,
    visit_count: s.vis,
    total_income: s.inc,
  }));

  // ── income_by_doctor_pttype: by (doctor, pttype) ──
  const incAgg = new Map<
    string,
    {
      doctor_name: string;
      staff_type: StaffType;
      pttype_name: string;
      pts: Set<string>;
      vis: number;
      inc: number;
    }
  >();
  V.forEach((r) => {
    const k = `${r.doctor_name}|${r.pttype_name}`;
    if (!incAgg.has(k))
      incAgg.set(k, {
        doctor_name: r.doctor_name,
        staff_type: r.staff_type,
        pttype_name: r.pttype_name,
        pts: new Set(),
        vis: 0,
        inc: 0,
      });
    const s = incAgg.get(k)!;
    s.pts.add(r.hn);
    s.vis++;
    s.inc += r.total_income;
  });
  const income_by_doctor_pttype: DentalIncomeRow[] = [...incAgg.values()].map(
    (s) => ({
      doctor_name: s.doctor_name,
      staff_type: s.staff_type,
      pttype_name: s.pttype_name,
      total_income: s.inc,
      patient_count: s.pts.size,
      visit_count: s.vis,
    }),
  );

  // ── patient_list ──
  const patient_list: DentalPatientRow[] = V.map((r) => {
    const ps = procByVn.get(r.vn) || [];
    const procText = ps
      .map((p) => `${p.procedure_code} ${p.procedure_name}`.trim())
      .join(", ");
    return {
      vstdate: r.vstdate,
      vsttime: r.vsttime,
      hn: r.hn,
      vn: r.vn,
      patient_name: r.patient_name,
      age: r.age,
      doctor_name: r.doctor_name,
      staff_type: r.staff_type,
      pttype_name: r.pttype_name,
      chief_complaint: r.chief_complaint,
      procedures: procText,
      total_income: r.total_income,
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    summary,
    queue,
    procedures,
    pttype,
    daily_trend,
    shift_report,
    income_by_doctor_pttype,
    patient_list,
  };
}
