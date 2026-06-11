// lib/pt.service.ts
// SQL service สำหรับ Dashboard กายภาพบำบัด (Physical Therapy — PT/PTA)
//
// *** เวอร์ชันนี้ยึดตรรกะ "ตามรายงานจริง" ของ HOSxP ***
// รายงานต้นฉบับนับงานกายภาพแบบนี้:
//   - ดึงจาก vn_stat โดยตรง (ไม่กรอง o.main_dep)
//   - visit จะถูกนับก็ต่อเมื่อ "มีรายการใน opitemrece ที่ผู้ลงค่าบริการ position_id = 9"
//   - attribute เจ้าของงาน = บุคลากรกายภาพที่ลงค่าบริการใน opitemrece (เลือกคนที่คิดเงินมากสุดของ VN)
//   - รายได้แยกหมวดตาม income code (c13–c16)
//   - group by vn → 1 แถวต่อ 1 visit
//
// ความต่างจากเวอร์ชันเดิม (ที่ทำให้ตัวเลขไม่ตรง 15 vs 11):
//   เดิม: กรอง o.main_dep = '033' แล้วหาเจ้าของจาก diag/oper/o.doctor + เกณฑ์ position หรือชื่อ กภ.
//   ใหม่: ยึด opitemrece + position_id = 9 ล้วน (เหมือนรายงาน) → ได้ชุด VN เดียวกับรายงาน
//
// หมายเหตุ (ปรับให้ตรง master ของ รพ. ก่อนใช้จริง):
//   - PT_DEPCODE: ใช้เฉพาะใน query "คิว" (queue) เท่านั้น — query records ไม่ใช้แล้ว
//   - position_id (ตาราง doctor_position): 9 = เจ้าหน้าที่กายภาพ (PT/PTA)
//   - หมวดรายได้ (income code) จัดกลุ่มตามรายงานต้นฉบับ: '14' = หมวดกายภาพ/เวชกรรมฟื้นฟู,
//     '03','04','17' = หมวดยา/เวชภัณฑ์ (ปรับโค้ด/ชื่อได้ตาม master)
//   - ชื่อหัตถการ join จากตารางใน PT_ICD9_TABLE (default icd9_sss)

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

const PT_DEPCODE = process.env.PT_DEPCODE ?? "033";
const DISCHARGED_STATUS = ["99", "98"];

// ตารางชื่อหัตถการ ICD-9 — whitelist กันชื่อตารางแปลกปลอม (ใส่ใน SQL ตรง ๆ ไม่ใช่ param)
const ICD9_TABLE_WHITELIST = ["icd9cm", "icd9_sss"] as const;
const PT_ICD9_TABLE = ICD9_TABLE_WHITELIST.includes(
  (process.env.PT_ICD9_TABLE ?? "") as (typeof ICD9_TABLE_WHITELIST)[number],
)
  ? (process.env.PT_ICD9_TABLE as string)
  : "icd9_sss";

// ใส่รหัส doctor ที่เป็น "ผู้ช่วยกายภาพ (PTA)" ตรงนี้ ถ้าระบบไม่ได้ตั้ง position_id ให้
// (ว่างไว้ = ตรงกับรายงานเป๊ะ; ถ้าเติม = ครอบคลุมคนที่ position ไม่ใช่ 9 เพิ่ม)
const PTA_DOCTOR_CODES: string[] = [];

// position_id จากตาราง doctor_position: 9 = เจ้าหน้าที่กายภาพ
const PT_POSITION_IDS = ["9"];

// ── เกณฑ์ "เป็นบุคลากรกายภาพ" บน opitemrece.doctor (alias dd) — ตามรายงาน: position_id เท่านั้น ──
const PT_POSITION_IN = PT_POSITION_IDS.map((p) => `'${p}'`).join(",");
const PTA_OR_DD = PTA_DOCTOR_CODES.length
  ? ` OR dd.code IN (${PTA_DOCTOR_CODES.map((c) => `'${c}'`).join(",")})`
  : "";
const PT_STAFF_PREDICATE = `(dd.position_id IN (${PT_POSITION_IN})${PTA_OR_DD})`;

// EXISTS: visit นี้มีรายการ opitemrece ที่ผู้ลงค่าบริการเป็นบุคลากรกายภาพหรือไม่
const PT_VISIT_EXISTS = `
      EXISTS (
        SELECT 1
          FROM opitemrece oo
          JOIN doctor dd ON dd.code = oo.doctor
         WHERE oo.vn = v.vn
           AND ${PT_STAFF_PREDICATE}
      )`;

// เลือกเจ้าของงาน = บุคลากรกายภาพที่คิดเงินมากสุดของ VN
const PT_STAFF_SUBQ = `
        (SELECT oo.doctor
           FROM opitemrece oo
           JOIN doctor dd ON dd.code = oo.doctor
          WHERE oo.vn = v.vn
            AND ${PT_STAFF_PREDICATE}
          GROUP BY oo.doctor
          ORDER BY SUM(oo.sum_price) DESC
          LIMIT 1)`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface RecordQueryRow extends RowDataPacket {
  date: string;
  vsttime: string;
  staff_id: string;
  staff_name: string;
  hn: string;
  patient_name: string;
  pcode: string;
  pttype: string;
  pttype_name: string;
  charge_physio: number; // c13: income '14'
  charge_drug: number; // c14: income '03','04','17'
  charge_other: number; // c15: income นอกเหนือจากนั้น
  charge_total: number; // c16: รวมทั้ง visit
  procedure_code: string;
  procedure_name: string;
}

interface QueueQueryRow extends RowDataPacket {
  queue_no: string;
  hn: string;
  patient_name: string;
  staff_name: string;
  vsttime: string;
  ovstist: string | null;
}

export interface PtRecord {
  date: string;
  shift: "morning" | "evening";
  staff_id: string;
  staff_name: string;
  role: "pt" | "pta";
  right: string;
  procedure: string;
  procedure_name: string;
  income: number; // = charge_total (รวมทั้ง visit) เพื่อ backward-compat
  physioCharge: number; // c13
  drugCharge: number; // c14
  otherCharge: number; // c15
  hn: string;
  patient_name: string;
}

export interface PtQueueItem {
  queue_no: string;
  hn: string;
  patient_name: string;
  staff_name: string;
  vsttime: string;
  status: string;
}

export interface PtDashboardData {
  updatedAt: string;
  records: PtRecord[];
  queue: PtQueueItem[];
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

function classifyRole(staffId: string, name: string): "pt" | "pta" {
  if (PTA_DOCTOR_CODES.includes(staffId)) return "pta";
  if ((name ?? "").includes("ผู้ช่วย")) return "pta";
  return "pt"; // กภ. / นักกายภาพบำบัด
}

// เวร: เช้า 08:30–16:30, นอกนั้นถือเป็นเย็น
function classifyShift(vsttime: string): "morning" | "evening" {
  const [h, m] = (vsttime || "00:00").split(":").map(Number);
  const mins = (h || 0) * 60 + (m || 0);
  return mins >= 8 * 60 + 30 && mins < 16 * 60 + 30 ? "morning" : "evening";
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function getPtDashboard(
  start: string,
  end: string,
): Promise<PtDashboardData> {
  // 1) records — 1 แถวต่อ 1 visit ที่ "มีบุคลากรกายภาพลงค่าบริการ" (ตามรายงาน)
  //    ไม่กรอง main_dep, attribute เจ้าของจาก opitemrece, รายได้แยกหมวด c13–c16
  const [rows] = await db.query<RecordQueryRow[]>(
    `
    SELECT x.*, d2.name AS staff_name
    FROM (
      SELECT
        v.vstdate                                  AS date,
        o.vsttime,
        ${PT_STAFF_SUBQ}                           AS staff_id,
        v.hn,
        CONCAT(pt.pname, pt.fname, ' ', pt.lname)  AS patient_name,
        COALESCE(v.pcode, '')                      AS pcode,
        v.pttype                                   AS pttype,
        ptt.name                                   AS pttype_name,
        COALESCE((SELECT SUM(oo.sum_price) FROM opitemrece oo
                   WHERE oo.vn = v.vn AND oo.income IN ('14')), 0)                      AS charge_physio,
        COALESCE((SELECT SUM(oo.sum_price) FROM opitemrece oo
                   WHERE oo.vn = v.vn AND oo.income IN ('03','04','17')), 0)            AS charge_drug,
        COALESCE((SELECT SUM(oo.sum_price) FROM opitemrece oo
                   WHERE oo.vn = v.vn AND oo.income NOT IN ('03','04','17','14')), 0)   AS charge_other,
        COALESCE((SELECT SUM(oo.sum_price) FROM opitemrece oo
                   WHERE oo.vn = v.vn), 0)                                              AS charge_total,
        (SELECT op.icd9 FROM doctor_operation op
          WHERE op.vn = v.vn ORDER BY op.icd9 LIMIT 1)                                  AS procedure_code,
        (SELECT COALESCE(ic9.name, op.icd9) FROM doctor_operation op
          LEFT JOIN ${PT_ICD9_TABLE} ic9 ON ic9.code = op.icd9
          WHERE op.vn = v.vn ORDER BY op.icd9 LIMIT 1)                                  AS procedure_name
      FROM vn_stat v
      LEFT JOIN ovst o     ON o.vn  = v.vn
      LEFT JOIN patient pt ON pt.hn = v.hn
      LEFT JOIN pttype ptt ON ptt.pttype = v.pttype
      WHERE v.vstdate BETWEEN ? AND ?
        AND ${PT_VISIT_EXISTS}
      GROUP BY v.vn
    ) x
    INNER JOIN doctor d2 ON d2.code = x.staff_id
    ORDER BY x.date, x.vsttime
    `,
    [start, end],
  );

  const records: PtRecord[] = rows.map((r) => ({
    date: r.date,
    shift: classifyShift(r.vsttime),
    staff_id: r.staff_id || "ไม่ระบุ",
    staff_name: (r.staff_name || r.staff_id || "ไม่ระบุ").trim(),
    role: classifyRole(r.staff_id, r.staff_name),
    right: classifyRight(r.pcode),
    procedure: r.procedure_code || "-",
    procedure_name: r.procedure_name || r.procedure_code || "-",
    income: Number(r.charge_total) || 0,
    physioCharge: Number(r.charge_physio) || 0,
    drugCharge: Number(r.charge_drug) || 0,
    otherCharge: Number(r.charge_other) || 0,
    hn: r.hn,
    patient_name: r.patient_name,
  }));

  // 2) คิว ณ ปัจจุบัน — ovst.oqueue เฉพาะวันนี้ของแผนก ที่ยังไม่จำหน่าย
  //    (คงพฤติกรรมเดิม: แสดงผู้รอคิวทุกคน ไม่กรองตามบุคลากร, ยังใช้ main_dep)
  const dischargedList = DISCHARGED_STATUS.map((s) => `'${s}'`).join(",");
  const [qrows] = await db.query<QueueQueryRow[]>(
    `
    SELECT
      o.oqueue                                   AS queue_no,
      o.hn,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname)  AS patient_name,
      COALESCE(d.name, o.doctor)                 AS staff_name,
      o.vsttime,
      o.ovstist
    FROM ovst o
    INNER JOIN patient pt  ON pt.hn = o.hn
    LEFT  JOIN doctor d    ON d.code = o.doctor
    WHERE o.vstdate = CURDATE()
      AND o.main_dep = ?
      AND o.an IS NULL
      AND (o.ovstost IS NULL OR o.ovstost = '' OR o.ovstost NOT IN (${dischargedList}))
    ORDER BY CAST(o.oqueue AS UNSIGNED), o.vsttime
    `,
    [PT_DEPCODE],
  );

  const queue: PtQueueItem[] = qrows.map((q) => ({
    queue_no: String(q.queue_no ?? "—"),
    hn: q.hn,
    patient_name: q.patient_name,
    staff_name: (q.staff_name || "—").trim(),
    vsttime: (q.vsttime || "").slice(0, 5),
    status: q.ovstist && q.ovstist.trim() !== "" ? "กำลังรับบริการ" : "รอ",
  }));

  return { updatedAt: new Date().toISOString(), records, queue };
}
