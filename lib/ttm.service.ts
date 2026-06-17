import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

// ── รหัสแผนกแพทย์แผนไทย (ใช้เฉพาะ query คิว) ──────────────────────────────────
const TTM_DEPCODE = process.env.TTM_DEPCODE ?? "023";

// สถานะ ovstost ที่ถือว่า "จำหน่าย/เสร็จสิ้น" แล้ว → ไม่เอามาแสดงในคิวรอ
const DISCHARGED_STATUS = ["99", "98"];

// position_id จากตาราง doctor_position: 11 = เจ้าหน้าที่แพทย์แผนไทย
const TTM_POSITION_IDS = ["11"];
// override รายคน (ใส่ doctor.code ถ้าระบบบันทึกตำแหน่งไม่ตรง)
const TTM_DOCTOR_CODES: string[] = [];

// ── เกณฑ์ "เป็นบุคลากรแพทย์แผนไทย" บน opitemrece.doctor (alias dd) — ตามรายงาน: position_id เท่านั้น ──
const TTM_POSITION_IN = TTM_POSITION_IDS.map((p) => `'${p}'`).join(",");
const OVERRIDE_DD = TTM_DOCTOR_CODES.length
  ? ` OR dd.code IN (${TTM_DOCTOR_CODES.map((c) => `'${c}'`).join(",")})`
  : "";
const TTM_STAFF_PREDICATE = `(dd.position_id IN (${TTM_POSITION_IN})${OVERRIDE_DD})`;

// EXISTS: visit นี้มีรายการ opitemrece ที่ผู้ลงค่าบริการเป็นบุคลากรแผนไทยหรือไม่
const TTM_VISIT_EXISTS = `
      EXISTS (
        SELECT 1 FROM opitemrece oo
        JOIN doctor dd ON dd.code = oo.doctor
        WHERE oo.vn = v.vn AND ${TTM_STAFF_PREDICATE}
      )`;

// เจ้าของงาน = บุคลากรแผนไทยที่คิดเงินรวมมากสุดของ VN
const TTM_STAFF_SUBQ = `
        (SELECT oo.doctor
           FROM opitemrece oo
           JOIN doctor dd ON dd.code = oo.doctor
          WHERE oo.vn = v.vn AND ${TTM_STAFF_PREDICATE}
          GROUP BY oo.doctor
          ORDER BY SUM(oo.sum_price) DESC
          LIMIT 1)`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface VisitRow extends RowDataPacket {
  vn: string;
  hn: string;
  vstdate: string;
  vsttime: string;
  doctor_code: string;
  doctor_name: string;
  patient_name: string;
  revenue: number;
  pcode: string;
  icd10: string;
  icd10_name: string;
}

interface QueueRow extends RowDataPacket {
  queue_no: string;
  vn: string;
  hn: string;
  patient_name: string;
  doctor_name: string;
  right_name: string;
  vsttime: string;
  ovstist: string | null;
  ovstost: string | null;
}

export interface TtmShift {
  visit_count: number;
  revenue: number;
}

export interface TtmDoctorSummary {
  doctor_id: string;
  doctor_name: string;
  patient_count: number;
  visit_count: number;
  revenue: number;
  shifts: Record<string, TtmShift>;
}

export interface TtmRightRow {
  doctor_id: string;
  doctor_name: string;
  right_code: string;
  right_name: string;
  visit_count: number;
  revenue: number;
}

export interface TtmIcdRow {
  icd10_code: string;
  icd10_name: string;
  use_count: number;
}

export interface TtmPatientRow {
  vstdate: string;
  vsttime: string;
  vn: string;
  hn: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  right_code: string;
  right_name: string;
  icd10: string;
  icd10_name: string;
  revenue: number;
}

export interface TtmQueueRow {
  queue_no: string;
  vn: string;
  hn: string;
  patient_name: string;
  doctor_name: string;
  right_name: string;
  vsttime: string;
  status: string;
}

export interface TtmDashboardData {
  updatedAt: string;
  summary: { doctors: TtmDoctorSummary[] };
  rights: { rows: TtmRightRow[] };
  icd10: { rows: TtmIcdRow[] };
  queue: { queue: TtmQueueRow[] };
  patients: { rows: TtmPatientRow[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const UC_PCODES = ["UC", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AJ", "AK"];

function classifyRight(pcode: string): { code: string; name: string } {
  const p = (pcode ?? "").trim();
  if (UC_PCODES.includes(p))
    return { code: "UC", name: "หลักประกันสุขภาพ (UC)" };
  if (p === "A2") return { code: "GOV", name: "ข้าราชการ" };
  if (p === "A7") return { code: "SSO", name: "ประกันสังคม" };
  if (p === "A1" || p === "A9") return { code: "SELF", name: "ชำระเงินเอง" };
  return { code: "OTHER", name: "อื่นๆ" };
}

const SHIFT_AM = "เช้า (06:00-16:30)";
const SHIFT_PM = "เย็น (16:30-20:30)";
const SHIFT_OT = "นอกเวลา";

function shiftName(vsttime: string): string {
  const [h, m] = (vsttime || "00:00").split(":").map(Number);
  const mins = (h || 0) * 60 + (m || 0);
  // เวรเช้าเริ่ม 06:00 → คนไข้ที่มา visit ก่อนเวลาทำการนับเป็นเช้า (ตรงกับ PT)
  if (mins >= 6 * 60 && mins < 16 * 60 + 30) return SHIFT_AM;
  if (mins >= 16 * 60 + 30 && mins < 20 * 60 + 30) return SHIFT_PM;
  return SHIFT_OT;
}
// ─── Main: ดึง + aggregate ทั้ง dashboard ในครั้งเดียว ─────────────────────────
export async function getTtmDashboard(
  start: string,
  end: string,
): Promise<TtmDashboardData> {
  // 1) visits (1 แถว/visit) — คัด visit ที่ "มีบุคลากรแผนไทยลงค่าบริการ" (ตามรายงาน)
  //    เจ้าของ = คนแผนไทยที่คิดเงินมากสุดของ VN, ไม่กรอง main_dep
  const [visits] = await db.query<VisitRow[]>(
    `
    SELECT x.*, d2.name AS doctor_name
    FROM (
      SELECT
        v.vn,
        v.hn,
        v.vstdate,
        o.vsttime,
        ${TTM_STAFF_SUBQ}                          AS doctor_code,
        CONCAT(pt.pname, pt.fname, ' ', pt.lname)  AS patient_name,
        COALESCE(v.income, 0)                      AS revenue,
        COALESCE(v.pcode, '')                      AS pcode,
        COALESCE(v.pdx, '')                        AS icd10,
        COALESCE(NULLIF(ic.tname, ''), ic.name, v.pdx, '') AS icd10_name
      FROM vn_stat v
      LEFT JOIN ovst o    ON o.vn  = v.vn
      LEFT JOIN patient pt ON pt.hn = v.hn
      LEFT JOIN icd101 ic  ON ic.code = v.pdx
      WHERE v.vstdate BETWEEN ? AND ?
        AND ${TTM_VISIT_EXISTS}
      GROUP BY v.vn
    ) x
    INNER JOIN doctor d2 ON d2.code = x.doctor_code
    ORDER BY x.vstdate, x.vsttime
    `,
    [start, end],
  );

  // ── summary รายแพทย์ + shifts ──
  const docMap = new Map<string, TtmDoctorSummary & { _hn: Set<string> }>();
  // ── rights (แพทย์ × สิทธิ์) ──
  const rightMap = new Map<string, TtmRightRow>();
  // ── icd10 ──
  const icdMap = new Map<string, TtmIcdRow>();
  // ── patients ──
  const patients: TtmPatientRow[] = [];

  for (const r of visits) {
    const docId = r.doctor_code || "ไม่ระบุ";
    const docName = (r.doctor_name || r.doctor_code || "ไม่ระบุ").trim();
    const rev = Number(r.revenue) || 0;
    const right = classifyRight(r.pcode);
    const sName = shiftName(r.vsttime);

    // summary
    let doc = docMap.get(docId);
    if (!doc) {
      doc = {
        doctor_id: docId,
        doctor_name: docName,
        patient_count: 0,
        visit_count: 0,
        revenue: 0,
        shifts: {},
        _hn: new Set<string>(),
      };
      docMap.set(docId, doc);
    }
    doc.visit_count++;
    doc.revenue += rev;
    doc._hn.add(r.hn);
    if (!doc.shifts[sName]) doc.shifts[sName] = { visit_count: 0, revenue: 0 };
    doc.shifts[sName].visit_count++;
    doc.shifts[sName].revenue += rev;

    // rights
    const rKey = `${docId}__${right.code}`;
    let rr = rightMap.get(rKey);
    if (!rr) {
      rr = {
        doctor_id: docId,
        doctor_name: docName,
        right_code: right.code,
        right_name: right.name,
        visit_count: 0,
        revenue: 0,
      };
      rightMap.set(rKey, rr);
    }
    rr.visit_count++;
    rr.revenue += rev;

    // icd10
    if (r.icd10) {
      let ic = icdMap.get(r.icd10);
      if (!ic) {
        ic = {
          icd10_code: r.icd10,
          icd10_name: r.icd10_name || r.icd10,
          use_count: 0,
        };
        icdMap.set(r.icd10, ic);
      }
      ic.use_count++;
    }

    // patient row
    patients.push({
      vstdate: r.vstdate,
      vsttime: r.vsttime,
      vn: r.vn,
      hn: r.hn,
      patient_name: r.patient_name,
      doctor_id: docId,
      doctor_name: docName,
      right_code: right.code,
      right_name: right.name,
      icd10: r.icd10,
      icd10_name: r.icd10_name,
      revenue: rev,
    });
  }

  const doctors: TtmDoctorSummary[] = Array.from(docMap.values())
    .map((d) => ({
      doctor_id: d.doctor_id,
      doctor_name: d.doctor_name,
      patient_count: d._hn.size,
      visit_count: d.visit_count,
      revenue: d.revenue,
      shifts: d.shifts,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const rightRows = Array.from(rightMap.values()).sort(
    (a, b) => b.revenue - a.revenue,
  );

  const icdRows = Array.from(icdMap.values())
    .sort((a, b) => b.use_count - a.use_count)
    .slice(0, 10);

  // 2) คิว ณ ปัจจุบัน — ดึงจาก ovst.oqueue เฉพาะวันนี้ของแผนก ที่ยังไม่จำหน่าย
  //    (คงพฤติกรรมเดิม: แสดงผู้รอคิวทุกคน ไม่กรองตามบุคลากร, ยังใช้ main_dep)
  const dischargedList = DISCHARGED_STATUS.map((s) => `'${s}'`).join(",");
  const [queueRows] = await db.query<QueueRow[]>(
    `
    SELECT
      o.oqueue                                   AS queue_no,
      o.vn,
      o.hn,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname)  AS patient_name,
      COALESCE(d.name, o.doctor)                 AS doctor_name,
      COALESCE(p2.name, '')                      AS right_name,
      o.vsttime,
      o.ovstist,
      o.ovstost
    FROM ovst o
    INNER JOIN patient pt  ON pt.hn = o.hn
    LEFT  JOIN doctor d    ON d.code = o.doctor
    LEFT  JOIN vn_stat v   ON v.vn  = o.vn
    LEFT  JOIN pttype p2   ON p2.pttype = v.pttype
    WHERE o.vstdate = CURDATE()
      AND o.main_dep = ?
      AND o.an IS NULL
      AND (o.ovstost IS NULL OR o.ovstost = '' OR o.ovstost NOT IN (${dischargedList}))
    ORDER BY CAST(o.oqueue AS UNSIGNED), o.vsttime
    `,
    [TTM_DEPCODE],
  );

  const queue: TtmQueueRow[] = queueRows.map((q) => ({
    queue_no: String(q.queue_no ?? "—"),
    vn: q.vn,
    hn: q.hn,
    patient_name: q.patient_name,
    doctor_name: (q.doctor_name || "—").trim(),
    right_name: q.right_name || "—",
    vsttime: (q.vsttime || "").slice(0, 5),
    // มีสถานะกำลังตรวจ (ovstist) แล้วถือว่ากำลังรับบริการ ไม่งั้น = รอ
    status: q.ovstist && q.ovstist.trim() !== "" ? "กำลังรับบริการ" : "รอ",
  }));

  return {
    updatedAt: new Date().toISOString(),
    summary: { doctors },
    rights: { rows: rightRows },
    icd10: { rows: icdRows },
    queue: { queue },
    patients: { rows: patients },
  };
}
