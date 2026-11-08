// lib/pt.service.ts
// SQL service สำหรับ Dashboard กายภาพบำบัด (Physical Therapy — PT/PTA)
//
// นับแยกตาม VN: มีค่าบริการ/ทะเบียนกายภาพ OPD หรือมีข้อความ PT in/on community
// ไม่พึ่ง vn_stat และไม่ดึง visit แพทย์อื่นมารวมด้วย HN/วันที่
// เชิงรุก OPD: ตรวจข้อความและชื่อประเภทบริการที่เชื่อมกับ VN นั้น

import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { classifyPtService, PT_SERVICE_BY_KEY } from "@/lib/ptIpdCategories";

import { buildPtRecordsQuery, type PhysicOpdSource } from "@/lib/pt-dashboard-query";
import { buildPtOutreachMatch, PT_OUTREACH_SCHEMA_TABLES, type PtOutreachMatch } from "@/lib/pt-outreach";
import type { PtServiceLocation } from "@/lib/pt-dashboard-filters";

const PT_DEPCODE = process.env.PT_DEPCODE ?? "033";
const DISCHARGED_STATUS = ["99", "98"];

// ตารางชื่อหัตถการ ICD-9 — whitelist กันชื่อตารางแปลกปลอม (ใส่ใน SQL ตรง ๆ ไม่ใช่ param)
const ICD9_TABLE_WHITELIST = ["icd9cm", "icd9_sss"] as const;
const PT_ICD9_TABLE = ICD9_TABLE_WHITELIST.includes(
  (process.env.PT_ICD9_TABLE ?? "") as (typeof ICD9_TABLE_WHITELIST)[number],
)
  ? (process.env.PT_ICD9_TABLE as (typeof ICD9_TABLE_WHITELIST)[number])
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

// ── "หัตถการ" = รายละเอียดการให้บริการที่นักกายภาพบันทึกไว้ ──────────────────
//
// เดิมช่องหัตถการดึงจาก doctor_operation.icd9 ซึ่งห้องกายภาพไม่ได้ลงเป็นประจำ
// (ส่วนใหญ่ว่าง หรือเป็นรหัสของแพทย์) → เปลี่ยนมาใช้ "รายละเอียดการให้บริการ"
// ที่นักกายภาพพิมพ์เอง แบบเดียวกับทะเบียนผู้ป่วยในงานกายภาพ (physic_main_ipd)
//   - ชื่อหัตถการ (procedure_name) = ข้อความที่บันทึกไว้ทั้งประโยค
//   - ตัวหัตถการ (procedure)       = หมวดของข้อความนั้น (ใช้จัดกลุ่ม/นับอันดับ)
//   - ถ้า visit นั้นไม่มีบันทึกกายภาพ → ใช้ icd9 แบบเดิมเป็นตัวสำรอง ข้อมูลไม่หาย
//
// ชื่อตารางฝั่ง OPD ไม่เท่ากันทุก HOSxP (physic_main_opd / physic_main) และบางที่
// ไม่มีเลย จึงหาจาก information_schema ตอน runtime แล้วจำไว้ ถ้าไม่เจอก็ข้ามไป
// ใช้ icd9 เหมือนเดิม (ไม่ทำให้ dashboard พังเพราะตารางไม่มีจริง)
const PHYSIC_OPD_CANDIDATES = ["physic_main_opd", "physic_main"] as const;

interface SchemaRow extends RowDataPacket {
  TABLE_NAME: string;
  COLUMN_NAME: string;
}

/** ตารางบันทึกกายภาพ OPD ที่ใช้ได้จริง (null = ไม่มี → ใช้ icd9 อย่างเดียว) */
let physicOpdSource: PhysicOpdSource | null | undefined;

async function resolvePhysicOpdSource(): Promise<PhysicOpdSource | null> {
  if (physicOpdSource !== undefined) return physicOpdSource;
  try {
    const [rows] = await db.query<SchemaRow[]>(
      `SELECT TABLE_NAME, COLUMN_NAME
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${PHYSIC_OPD_CANDIDATES.map(() => "?").join(",")})
          AND COLUMN_NAME IN ('vn', 'vstdate', 'service_text', 'doctor', 'doctor_code', 'staff')`,
      PHYSIC_OPD_CANDIDATES,
    );
    const cols = new Map<string, Set<string>>();
    for (const r of rows) {
      const t = String(r.TABLE_NAME).toLowerCase();
      if (!cols.has(t)) cols.set(t, new Set());
      cols.get(t)!.add(String(r.COLUMN_NAME).toLowerCase());
    }
    // ต้องมีครบทั้ง 3 คอลัมน์ถึงจะ query ตามช่วงวันแล้วผูกกลับเข้า visit ได้
    const table =
      PHYSIC_OPD_CANDIDATES.find((t) => {
        const c = cols.get(t);
        return c?.has("vn") && c.has("vstdate") && c.has("service_text");
      }) ?? null;
    const staffColumn = table
      ? (["doctor", "doctor_code", "staff"] as const).find((c) => cols.get(table)?.has(c)) ?? null
      : null;
    physicOpdSource = table ? { table, staffColumn } : null;
  } catch (e) {
    console.error("resolvePhysicOpdSource failed:", e);
    physicOpdSource = null;
  }
  return physicOpdSource;
}

let outreachCache: { match: PtOutreachMatch; expires: number } | undefined;
async function resolvePtOutreachMatch(): Promise<PtOutreachMatch> {
  if (outreachCache && outreachCache.expires > Date.now()) return outreachCache.match;
  // Surface metadata errors instead of silently reporting zero outreach visits.
  const [rows] = await db.query<(SchemaRow & { DATA_TYPE: string })[]>(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN (${PT_OUTREACH_SCHEMA_TABLES.map(() => "?").join(",")})`,
    PT_OUTREACH_SCHEMA_TABLES,
  );
  const match = buildPtOutreachMatch(rows);
  outreachCache = { match, expires: Date.now() + 60 * 60 * 1000 };
  return match;
}

interface ServiceTextRow extends RowDataPacket {
  vn: string;
  service_text: string | null;
}

/** vn → รายละเอียดการให้บริการกายภาพของ visit นั้น (หลายรายการต่อกันด้วย " | ") */
async function fetchPhysicServiceText(
  start: string,
  end: string,
): Promise<Map<string, string>> {
  const source = await resolvePhysicOpdSource();
  const table = source?.table;
  const out = new Map<string, string>();
  if (!table) return out;
  try {
    const [rows] = await db.query<ServiceTextRow[]>(
      // ชื่อตารางมาจาก whitelist ในไฟล์นี้เท่านั้น (ไม่ได้มาจาก user input)
      `SELECT pm.vn AS vn,
              GROUP_CONCAT(DISTINCT NULLIF(TRIM(pm.service_text), '')
                           ORDER BY pm.service_text SEPARATOR ' | ') AS service_text
         FROM ${table} pm
        WHERE pm.vstdate BETWEEN ? AND ?
          AND pm.vn IS NOT NULL AND pm.vn <> ''
        GROUP BY pm.vn`,
      [start, end],
    );
    for (const r of rows) {
      const text = (r.service_text ?? "").trim();
      if (text) out.set(String(r.vn), text);
    }
  } catch (e) {
    console.error("fetchPhysicServiceText failed:", e);
  }
  return out;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface RecordQueryRow extends RowDataPacket {
  vn: string;
  date: string;
  vsttime: string;
  svc_time: string;
  staff_id: string;
  staff_name: string;
  hn: string;
  cid: string | null;
  patient_name: string | null;
  pcode: string;
  pttype: string;
  pttype_name: string;
  charge_physio: number; // c13: income '14'
  charge_drug: number; // c14: income '03','04','17'
  charge_other: number; // c15: income นอกเหนือจากนั้น
  charge_total: number; // c16: รวมทั้ง visit
  is_outreach: number;
  procedure_code: string;
  procedure_name: string;
}

interface QueueQueryRow extends RowDataPacket {
  vn: string;
  is_outreach: number;
  queue_no: string;
  hn: string;
  patient_name: string;
  staff_name: string;
  vsttime: string;
  ovstist: string | null;
}

export interface PtRecord {
  vn: string;
  service_location: PtServiceLocation;
  date: string;
  shift: "morning" | "evening";
  staff_id: string;
  staff_name: string;
  role: "pt" | "pta" | "unknown";
  right: string;
  /** หมวดของรายละเอียดการให้บริการ (สำรอง: รหัส icd9 เดิม) */
  procedure: string;
  /** รายละเอียดการให้บริการที่นักกายภาพบันทึก (สำรอง: ชื่อ icd9 เดิม) */
  procedure_name: string;
  /** ข้อความรายละเอียดการให้บริการดิบ ("" = visit นั้นไม่มีบันทึก) */
  service_text: string;
  income: number; // = charge_total (รวมทั้ง visit) เพื่อ backward-compat
  physioCharge: number; // c13
  drugCharge: number; // c14
  otherCharge: number; // c15
  hn: string;
  /** เลขบัตรประชาชน 13 หลัก ("" = ไม่มีในทะเบียน) */
  cid: string;
  patient_name: string;
}

export interface PtQueueItem {
  vn: string;
  service_location: PtServiceLocation;
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

function classifyRole(staffId: string, name: string): "pt" | "pta" | "unknown" {
  if (!staffId) return "unknown";
  if (PTA_DOCTOR_CODES.includes(staffId)) return "pta";
  if ((name ?? "").includes("ผู้ช่วย")) return "pta";
  return "pt"; // กภ. / นักกายภาพบำบัด
}

// เวร: เช้า 06:00–16:30, นอกช่วงนี้ (ตั้งแต่ 16:30 เป็นต้นไป หรือก่อน 06:00) = เย็น
function classifyShift(vsttime: string): "morning" | "evening" {
  const [h, m] = (vsttime || "00:00").split(":").map(Number);
  const mins = (h || 0) * 60 + (m || 0);
  return mins >= 6 * 60 && mins < 16 * 60 + 30 ? "morning" : "evening";
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function getPtDashboard(
  start: string,
  end: string,
): Promise<PtDashboardData> {
  // 1 แถวต่อ VN: visit พบแพทย์อย่างเดียวของ HN เดียวกันไม่ถูกนำมารวม
  const source = await resolvePhysicOpdSource();
  const outreach = await resolvePtOutreachMatch();
  const [rows] = await db.query<RecordQueryRow[]>(
    buildPtRecordsQuery(source, PT_ICD9_TABLE, PT_STAFF_PREDICATE, outreach),
    [...outreach.params, start, end],
  );

  // รายละเอียดการให้บริการของแต่ละ visit — ใช้แทน "หัตถการ" (ดูหมายเหตุด้านบน)
  const serviceTextByVn = await fetchPhysicServiceText(start, end);

  const records: PtRecord[] = rows.map((r) => {
    const detail = serviceTextByVn.get(String(r.vn)) ?? "";
    const cat = detail ? classifyPtService(detail).primary : "";
    return {
      vn: String(r.vn),
      service_location: Number(r.is_outreach) ? "outreach" : "hospital",
      date: r.date,
      shift: classifyShift(r.svc_time),
      staff_id: r.staff_id || "ไม่ระบุ",
      staff_name: (r.staff_name || r.staff_id || "ไม่ระบุ").trim(),
      role: classifyRole(r.staff_id, r.staff_name),
      right: classifyRight(r.pcode),
      procedure: cat
        ? (PT_SERVICE_BY_KEY.get(cat)?.label ?? cat)
        : r.procedure_code || "-",
      procedure_name: detail || r.procedure_name || r.procedure_code || "-",
      service_text: detail,
      income: Number(r.charge_total) || 0,
      physioCharge: Number(r.charge_physio) || 0,
      drugCharge: Number(r.charge_drug) || 0,
      otherCharge: Number(r.charge_other) || 0,
      hn: r.hn,
      cid: (r.cid ?? "").trim(),
      patient_name: r.patient_name || "ไม่ระบุ",
    };
  });

  // 2) คิว ณ ปัจจุบัน — ovst.oqueue เฉพาะวันนี้ของแผนก ที่ยังไม่จำหน่าย
  //    รับแผนกกายภาพหรือ visit ที่มีคำระบุ PT community ไม่กรองตามบุคลากร
  const dischargedList = DISCHARGED_STATUS.map((s) => `'${s}'`).join(",");
  const [qrows] = await db.query<QueueQueryRow[]>(
    `
    SELECT
      o.vn,
      ${outreach.sql} AS is_outreach,
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
      AND (o.main_dep = ? OR ${outreach.sql})
      AND (o.an IS NULL OR o.an = '')
      AND (o.ovstost IS NULL OR o.ovstost = '' OR o.ovstost NOT IN (${dischargedList}))
    ORDER BY CAST(o.oqueue AS UNSIGNED), o.vsttime
    `,
    [...outreach.params, PT_DEPCODE, ...outreach.params],
  );

  const queue: PtQueueItem[] = qrows.map((q) => ({
    vn: String(q.vn),
    service_location: Number(q.is_outreach) ? "outreach" : "hospital",
    queue_no: String(q.queue_no ?? "—"),
    hn: q.hn,
    patient_name: q.patient_name,
    staff_name: (q.staff_name || "—").trim(),
    vsttime: (q.vsttime || "").slice(0, 5),
    status: q.ovstist && q.ovstist.trim() !== "" ? "กำลังรับบริการ" : "รอ",
  }));

  return { updatedAt: new Date().toISOString(), records, queue };
}
