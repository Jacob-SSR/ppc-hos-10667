// lib/pt.service.ts
// SQL service สำหรับ Dashboard กายภาพบำบัด (Physical Therapy — PT/PTA)
// แหล่งข้อมูล: ovst (visit + คิว oqueue) + vn_stat (รายได้/สิทธิ์) + patient + doctor
//             + doctor_operation (หัตถการ icd9) + icd9cm (ชื่อหัตถการ)
//
// *** การ attribute เจ้าของงาน (สำคัญ) ***
// ปัญหาเดิม: กรองด้วย o.main_dep = แผนกกายภาพ แล้วยึด o.doctor ตรง ๆ
// แต่ o.doctor คือ "หมอหลักของ VN" อาจไม่ใช่นักกายภาพที่ให้บริการ
// เคสคนไข้เข้าหลายคลินิกใน VN เดียว ทำให้งานไปโผล่ใต้คนผิด หรือมีบุคลากรที่ไม่ใช่
// กายภาพโผล่ในรายงาน
// แก้: ยึด "บุคลากรกายภาพ" ของ VN ตามลำดับ
//   (1) คนที่ลงวินิจฉัยใน ovstdiag เป็นบุคลากรกายภาพ
//   (2) คนที่ทำหัตถการใน doctor_operation เป็นบุคลากรกายภาพ
//   (3) หมอหลัก o.doctor เฉพาะเมื่อตัวเองเป็นบุคลากรกายภาพ
//   - visit ถูกนับเป็นงานกายภาพก็ต่อเมื่อหาบุคลากรกายภาพเจอ (ไม่งั้นตัดทิ้ง)
//     หมายเหตุ: กายภาพลง doctor_operation/ovstdiag น้อย เคสส่วนใหญ่จึงตกที่ข้อ (3)
//     คือ o.doctor ที่เป็นบุคลากรกายภาพ — ถ้าบุคลากรไม่ได้ตั้ง position/ชื่อให้ตรง
//     ให้เติม PTA_DOCTOR_CODES หรือ position_id=9 ใน doctor ก่อน ไม่งั้นข้อมูลจะหาย
//
// หมายเหตุ (ปรับให้ตรงกับ master ของ รพ. ก่อนใช้งานจริง):
//   - PT_DEPCODE: รหัสแผนกกายภาพบำบัด (จาก kskdepartment) — รพ.พลับพลาชัย = '033'
//   - position_id (ตาราง doctor_position): 9 = เจ้าหน้าที่กายภาพ (ครอบคลุมทั้ง PT/PTA)
//   - PT/PTA: แยกจากชื่อ ("กภ." = นักกายภาพ PT, มีคำว่า "ผู้ช่วย" = PTA)
//     ถ้าต้องการแม่นกว่านี้ ใส่รหัส doctor ของ PTA ลงใน PTA_DOCTOR_CODES
//   - หัตถการ: ดึงหัตถการแรกของแต่ละ visit จาก doctor_operation (กัน income ซ้ำ)
//     ชื่อหัตถการ join จากตารางใน PT_ICD9_TABLE (default icd9_sss)
//   - สมมติว่า ovstdiag มีคอลัมน์ doctor (HOSxP ทั่วไป)

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

// ใส่รหัส doctor ที่เป็น "ผู้ช่วยกายภาพ (PTA)" ตรงนี้ ถ้าระบบไม่ได้ระบุในชื่อ
const PTA_DOCTOR_CODES: string[] = [];

// position_id จากตาราง doctor_position: 9 = เจ้าหน้าที่กายภาพ
const PT_POSITION_IDS = ["9"];

// ── predicate: doctor (alias) เป็นบุคลากรกายภาพหรือไม่ ────────────────────────
function ptPredicate(alias: string): string {
  return `(
    ${alias}.position_id IN (${PT_POSITION_IDS.map((p) => `'${p}'`).join(",")})
    OR ${alias}.name LIKE 'กภ.%'
    OR ${alias}.name LIKE '%กายภาพ%'
    ${PTA_DOCTOR_CODES.length ? `OR ${alias}.code IN (${PTA_DOCTOR_CODES.map((c) => `'${c}'`).join(",")})` : ""}
  )`;
}
// override บน .doctor ของแต่ละตาราง (เผื่อ override ที่ code)
const OVERRIDE_OP_IN = PTA_DOCTOR_CODES.length
  ? `OR op.doctor IN (${PTA_DOCTOR_CODES.map((c) => `'${c}'`).join(",")})`
  : "";
const OVERRIDE_OD_IN = PTA_DOCTOR_CODES.length
  ? `OR od.doctor IN (${PTA_DOCTOR_CODES.map((c) => `'${c}'`).join(",")})`
  : "";

// subquery: หา "บุคลากรกายภาพ" ของ VN ตามลำดับ (วินิจฉัย → หัตถการ)
const PT_DIAG_DOCTOR_SUBQ = `
          (SELECT od.doctor
             FROM ovstdiag od
             JOIN doctor dd ON dd.code = od.doctor
            WHERE od.vn = o.vn
              AND od.doctor IS NOT NULL AND od.doctor <> ''
              AND (${ptPredicate("dd")} ${OVERRIDE_OD_IN})
            LIMIT 1)`;
const PT_OPER_DOCTOR_SUBQ = `
          (SELECT op.doctor
             FROM doctor_operation op
             JOIN doctor dd ON dd.code = op.doctor
            WHERE op.vn = o.vn
              AND op.doctor IS NOT NULL AND op.doctor <> ''
              AND (${ptPredicate("dd")} ${OVERRIDE_OP_IN})
            LIMIT 1)`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface RecordQueryRow extends RowDataPacket {
  date: string;
  vsttime: string;
  staff_id: string;
  staff_name: string;
  hn: string;
  patient_name: string;
  income: number;
  pcode: string;
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
  income: number;
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
  // 1) records — 1 แถวต่อ 1 visit ของแผนกกายภาพ เจ้าของ = บุคลากรกายภาพจริง
  //    ตัด VN ที่ไม่มีบุคลากรกายภาพ (staff_id = NULL) ออกด้วย INNER JOIN ชั้นนอก
  const [rows] = await db.query<RecordQueryRow[]>(
    `
    SELECT x.*, d2.name AS staff_name
    FROM (
      SELECT
        o.vstdate                                  AS date,
        o.vsttime,
        COALESCE(
          ${PT_DIAG_DOCTOR_SUBQ},
          ${PT_OPER_DOCTOR_SUBQ},
          CASE WHEN ${ptPredicate("d")} THEN o.doctor END
        )                                          AS staff_id,
        o.hn,
        CONCAT(pt.pname, pt.fname, ' ', pt.lname)  AS patient_name,
        COALESCE(v.income, 0)                      AS income,
        COALESCE(v.pcode, '')                      AS pcode,
        (SELECT op.icd9 FROM doctor_operation op
          WHERE op.vn = o.vn ORDER BY op.icd9 LIMIT 1)                       AS procedure_code,
        (SELECT COALESCE(ic9.name, op.icd9) FROM doctor_operation op
          LEFT JOIN ${PT_ICD9_TABLE} ic9 ON ic9.code = op.icd9
          WHERE op.vn = o.vn ORDER BY op.icd9 LIMIT 1)                       AS procedure_name
      FROM ovst o
      INNER JOIN vn_stat v   ON v.vn  = o.vn
      INNER JOIN patient pt  ON pt.hn = o.hn
      LEFT  JOIN doctor d    ON d.code = o.doctor
      WHERE o.vstdate BETWEEN ? AND ?
        AND o.main_dep = ?
        AND o.an IS NULL
    ) x
    INNER JOIN doctor d2 ON d2.code = x.staff_id
    ORDER BY x.date, x.vsttime
    `,
    [start, end, PT_DEPCODE],
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
    income: Number(r.income) || 0,
    hn: r.hn,
    patient_name: r.patient_name,
  }));

  // 2) คิว ณ ปัจจุบัน — ovst.oqueue เฉพาะวันนี้ของแผนก ที่ยังไม่จำหน่าย
  //    (คงพฤติกรรมเดิม: แสดงผู้รอคิวทุกคน ไม่กรองตามบุคลากร)
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