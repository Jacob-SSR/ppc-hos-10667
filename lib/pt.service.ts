// lib/pt.service.ts
// SQL service สำหรับ Dashboard กายภาพบำบัด (Physical Therapy — PT/PTA)
// แหล่งข้อมูล: ovst (visit + คิว oqueue) + vn_stat (รายได้/สิทธิ์) + patient + doctor
//             + doctor_operation (หัตถการ icd9) + icd9cm (ชื่อหัตถการ)
//
// หมายเหตุ (ปรับให้ตรงกับ master ของ รพ. ก่อนใช้งานจริง):
//   - PT_DEPCODE: รหัสแผนกกายภาพบำบัด (จาก kskdepartment) — รพ.พลับพลาชัย = '033'
//   - PT/PTA: แยกจากชื่อเจ้าหน้าที่ ("กภ." = นักกายภาพ PT, มีคำว่า "ผู้ช่วย" = PTA)
//     ถ้าต้องการแม่นกว่านี้ ใส่รหัส doctor ของ PTA ลงใน PTA_DOCTOR_CODES
//   - หัตถการ: ดึงหัตถการแรกของแต่ละ visit จาก doctor_operation (กัน income ซ้ำ)
//     ชื่อหัตถการ join จากตารางใน PT_ICD9_TABLE — รพ.พลับพลาชัยตรวจจริงแล้วว่า
//     doctor_operation.icd9 ผูกกับ 'icd9_sss' (icd9cm ไม่มีรหัสพวกนี้) จึงตั้ง default = icd9_sss
//     ถ้า รพ. อื่นเก็บเป็น icd9cm ให้ตั้ง PT_ICD9_TABLE=icd9cm — รองรับ 2 ค่านี้ (กัน SQL injection)
//     ถ้าหารหัสในตารางไม่เจอ จะแสดงเป็นรหัส icd9 แทน (ไม่พัง)
//     หมายเหตุ: กายภาพลง doctor_operation น้อยมาก (พบ ~6 แถว) คอลัมน์หัตถการจึงอาจว่างเป็นปกติ

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
  // 1) records — 1 แถวต่อ 1 visit ของแผนกกายภาพ (หัตถการแรกของ visit นั้น)
  const [rows] = await db.query<RecordQueryRow[]>(
    `
    SELECT
      o.vstdate                                  AS date,
      o.vsttime,
      o.doctor                                   AS staff_id,
      COALESCE(d.name, o.doctor)                 AS staff_name,
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
    ORDER BY o.vstdate, o.vsttime
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
