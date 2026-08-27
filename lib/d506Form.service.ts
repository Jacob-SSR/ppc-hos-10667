// lib/d506Form.service.ts
// เติมข้อมูลลง "บัตรรายงานผู้ป่วย (แบบ รง.506)" อัตโนมัติจาก HOSxP
// ทะเบียนในชีต (D506_SPREADSHEET_ID) มีแค่ข้อมูลหลัก ๆ — ช่องอย่างภาวะสมรส สัญชาติ
// อาชีพ วันตาย ฯลฯ เจ้าหน้าที่ต้องเขียนมือทุกใบ. ตัวนี้ดึงจาก HOSxP มาให้ระบบติ๊ก/กรอกเอง
//
// หมายเหตุเรื่อง schema: HOSxP แต่ละเวอร์ชันมีคอลัมน์ไม่เท่ากัน จึงใช้ SELECT * แล้ว
// เลือกคอลัมน์ฝั่ง TS (pick()) แทนการอ้างชื่อคอลัมน์ตรง ๆ ใน SQL — เวอร์ชันที่ไม่มี
// คอลัมน์นั้นจะได้ค่าว่างแทนที่จะพัง query ทั้งใบ
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { cachedQuery } from "./cache";

const TTL = 3600; // ข้อมูลทะเบียนผู้ป่วยแทบไม่เปลี่ยน → cache 1 ชม.

// ─── Types ──────────────────────────────────────────────────────────────────
export interface D506FormExtra {
  hn: string;
  found: boolean;
  cid: string;
  /** "ชาย" | "หญิง" | "" (patient.sex: 1 = ชาย, 2 = หญิง) */
  sex: "" | "ชาย" | "หญิง";
  /** คำนำหน้าชื่อจากทะเบียน HOSxP — ใช้เดาเพศได้เมื่อชีตไม่ได้กรอก */
  prefix: string;
  /** "โสด" | "คู่" | "หย่าร้าง" | "หม้าย" | "" (ตามที่จับคำได้จากทะเบียน HOSxP) */
  marital: "" | "โสด" | "คู่" | "หย่าร้าง" | "หม้าย";
  /** true = คนไทย, false = คนต่างชาติ, null = ไม่ทราบ */
  thai: boolean | null;
  nationalityName: string;
  occupation: string;
  /** "1" = ในเขตเทศบาล, "2" = อบต./นอกเขต, "" = ไม่ทราบ */
  municipality: "" | "1" | "2";
  phone: string;
  /** วันเกิด/ที่อยู่ จาก HOSxP — ใช้เป็นตัวสำรองเมื่อช่องในชีตว่าง */
  dob: string; // DD/MM/YYYY (พ.ศ.)
  house: string;
  moo: string;
  tambon: string;
  amphoe: string;
  province: string;
  /** จาก surveil_member ของ HN นี้ (ใบที่ใกล้วันรับรายงานที่สุด) */
  onsetDate: string; // DD/MM/YYYY (พ.ศ.)
  dxDate: string;
  reportDate: string;
  deathDate: string;
  ptype: string; // OPD / IPD
  code506: string;
  icd10: string;
  /** สถานะจาก report506status (หาย / ตาย / ยังรักษา / …) */
  status: string;
  reporter: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

const s = (v: unknown): string => (v == null ? "" : String(v).trim());

/** เลือกค่าจากคอลัมน์แรกที่มีจริงในแถว (ชื่อคอลัมน์ HOSxP ต่างกันตามเวอร์ชัน) */
function pick(row: Row | null, ...candidates: string[]): string {
  if (!row) return "";
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(row)) lower[k.toLowerCase()] = row[k];
  for (const c of candidates) {
    const v = lower[c.toLowerCase()];
    if (v != null && s(v) !== "") return s(v);
  }
  return "";
}

/** ค่าวันที่จาก MySQL → "DD/MM/พ.ศ." ให้ตรงรูปแบบที่ Form506 ใช้ตัด split("/") */
function toThai(v: unknown): string {
  const raw = s(v);
  if (v == null || raw === "" || raw === "NULL" || raw.startsWith("0000")) return "";
  let d: Date;
  if (v instanceof Date) {
    d = v;
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    // บาง driver/บาง export คืนมาเป็น DD/MM/YYYY (และอาจเป็น พ.ศ.)
    const [dd, mm, yy] = raw.split("/").map(Number);
    d = new Date(yy > 2500 ? yy - 543 : yy, mm - 1, dd);
  } else {
    d = new Date(raw.slice(0, 10));
  }
  if (Number.isNaN(d.getTime())) return "";
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear() + 543,
  ].join("/");
}

/** อ่านชื่อจากตาราง lookup ของ HOSxP (occupation / nationality / marrystatus …)
 *  ตารางไม่มี/คอลัมน์ไม่ตรง → คืนค่าว่าง ไม่ให้ทั้งฟอร์มพัง */
async function lookupName(table: string, code: string): Promise<string> {
  if (!code) return "";
  // ชื่อตาราง/คอลัมน์เป็น literal ในซอร์สนี้เท่านั้น ไม่รับจาก input ผู้ใช้
  const ALLOWED: Record<string, string> = {
    marrystatus: "marrystatus",
    occupation: "occupation",
    nationality: "nationality",
    citizenship: "citizenship",
  };
  const keyCol = ALLOWED[table];
  if (!keyCol) return "";
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT name FROM ${table} WHERE ${keyCol} = ? LIMIT 1`,
      [code],
    );
    return s(rows[0]?.name);
  } catch {
    return "";
  }
}

/** ชื่อภาวะสมรสจาก HOSxP → ตัวเลือกบนแบบ รง.506 (โสด / คู่ / หย่าร้าง / หม้าย) */
function toMarital(name: string, code: string): D506FormExtra["marital"] {
  const t = name;
  if (/โสด/.test(t)) return "โสด";
  if (/หย่า|แยก/.test(t)) return "หย่าร้าง";
  if (/หม้าย|หมั้าย/.test(t)) return "หม้าย";
  if (/คู่|สมรส/.test(t)) return "คู่";
  // ไม่มีตาราง lookup → เดาจากรหัสมาตรฐาน HOSxP (1 โสด 2 คู่ 3 หม้าย 4 หย่า)
  if (!t) {
    if (code === "1") return "โสด";
    if (code === "2") return "คู่";
    if (code === "3") return "หม้าย";
    if (code === "4") return "หย่าร้าง";
  }
  return "";
}

/** surveil_member.department เก็บได้ทั้ง "OPD"/"IPD"/"ผู้ป่วยนอก"/รหัสแผนก
 *  → ตัดสินจากคำก่อน ถ้าไม่ชัดค่อยดูว่ามี AN (นอน รพ.) หรือมีแค่ VN */
function toPtype(dept: string, an: string, vn: string): string {
  const t = dept.toLowerCase();
  if (/opd|นอก/.test(t)) return "OPD";
  if (/ipd|ใน|admit/.test(t)) return "IPD";
  if (an) return "IPD";
  if (vn) return "OPD";
  return dept.toUpperCase();
}

// ─── query ──────────────────────────────────────────────────────────────────
async function fetchFormExtra(hn: string, reportDate: string): Promise<D506FormExtra> {
  const empty: D506FormExtra = {
    hn, found: false, cid: "", sex: "", prefix: "", marital: "", thai: null, nationalityName: "",
    occupation: "", municipality: "", phone: "", dob: "", house: "", moo: "",
    tambon: "", amphoe: "", province: "", onsetDate: "", dxDate: "",
    reportDate: "", deathDate: "", ptype: "", code506: "", icd10: "",
    status: "", reporter: "",
  };
  if (!hn) return empty;

  // 1) ทะเบียนผู้ป่วย — SELECT * เพราะชุดคอลัมน์ต่างกันตามเวอร์ชัน HOSxP
  let pt: Row | null = null;
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM patient WHERE hn = ? LIMIT 1`,
      [hn],
    );
    pt = (rows[0] as Row) ?? null;
  } catch {
    pt = null;
  }

  // 2) ใบ 506 ของ HN นี้ — เลือกใบที่ใกล้ "วันที่รับรายงาน" ในชีตที่สุด
  //    (ผู้ป่วยคนเดียวอาจมีหลายใบ เช่นป่วยซ้ำต่างปี)
  let sv: Row | null = null;
  try {
    const [rows] = reportDate
      ? await db.query<RowDataPacket[]>(
          `SELECT s.*, rs.name AS status_name
             FROM surveil_member s
             LEFT JOIN report506status rs ON rs.code = s.ptstat
            WHERE s.hn = ?
            ORDER BY ABS(DATEDIFF(s.report_date, ?)) ASC, s.report_date DESC
            LIMIT 1`,
          [hn, reportDate],
        )
      : await db.query<RowDataPacket[]>(
          `SELECT s.*, rs.name AS status_name
             FROM surveil_member s
             LEFT JOIN report506status rs ON rs.code = s.ptstat
            WHERE s.hn = ?
            ORDER BY s.report_date DESC
            LIMIT 1`,
          [hn],
        );
    sv = (rows[0] as Row) ?? null;
  } catch {
    sv = null;
  }

  if (!pt && !sv) return empty;

  // ที่อยู่ (ชื่อตำบล/อำเภอ/จังหวัด) — แปลงรหัสผ่าน thaiaddress เหมือน d506.service
  const chw = pick(sv, "chwpart") || pick(pt, "chwpart");
  const amp = pick(sv, "amppart") || pick(pt, "amppart");
  const tmb = pick(sv, "tmbpart") || pick(pt, "tmbpart");
  let tambon = "", amphoe = "", province = "";
  if (chw) {
    try {
      // thaiaddress เก็บรหัสแบบ 2 หลักเสมอ ('05') แต่ patient/surveil_member
      // บางเรคคอร์ดเก็บ '5' → ต้อง LPAD ทั้งสองฝั่งไม่งั้น join ไม่ติด (ตำบลว่าง)
      const pad2 = (v: string) => v.padStart(2, "0");
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT
           MAX(IF(LPAD(amppart,2,'0') = '00' AND LPAD(tmbpart,2,'0') = '00', name, NULL)) AS province,
           MAX(IF(LPAD(amppart,2,'0') = ?    AND LPAD(tmbpart,2,'0') = '00', name, NULL)) AS amphoe,
           MAX(IF(LPAD(amppart,2,'0') = ?    AND LPAD(tmbpart,2,'0') = ?,    name, NULL)) AS tambon
         FROM thaiaddress WHERE LPAD(chwpart,2,'0') = ?`,
        [pad2(amp || "00"), pad2(amp || "00"), pad2(tmb || "00"), pad2(chw)],
      );
      province = s(rows[0]?.province);
      amphoe = s(rows[0]?.amphoe);
      tambon = s(rows[0]?.tambon);
    } catch {
      // ไม่มีตาราง thaiaddress → ปล่อยว่าง ให้ค่าจากชีตทำงานต่อ
    }
  }

  const marryCode = pick(pt, "marrystatus", "marystatus", "marital_status");
  const natCode = pick(pt, "nationality");
  const occCode = pick(pt, "occupation");

  const [marryName, natName, occName] = await Promise.all([
    lookupName("marrystatus", marryCode),
    lookupName("nationality", natCode),
    lookupName("occupation", occCode),
  ]);

  // สัญชาติ: HOSxP ใช้ '99' = ไทย (ตรงกับที่ report.service.ts ใช้อยู่)
  const thai =
    natCode === "99" || /ไทย/.test(natName)
      ? true
      : natCode
        ? false
        : null;

  // ในเขตเทศบาล/อบต. — คอลัมน์นี้มีเฉพาะบางเวอร์ชัน ไม่มีก็ปล่อยไม่ติ๊ก
  const muniRaw = pick(pt, "in_muni", "municipality", "in_municipality");
  const municipality: D506FormExtra["municipality"] =
    muniRaw === "1" || muniRaw === "Y" ? "1" : muniRaw === "2" || muniRaw === "N" ? "2" : "";

  // ตาราง patient ของ HOSxP ใช้คอลัมน์ "deathday" (ไม่ใช่ death_date)
  const deathRaw =
    pick(sv, "death_date", "deathday") || pick(pt, "deathday", "death_date");

  return {
    hn,
    found: true,
    cid: pick(pt, "cid", "citizenship_id"),
    sex: pick(pt, "sex") === "1" ? "ชาย" : pick(pt, "sex") === "2" ? "หญิง" : "",
    prefix: pick(pt, "pname", "prename"),
    marital: toMarital(marryName, marryCode),
    thai,
    nationalityName: natName || natCode,
    occupation: occName,
    municipality,
    phone: pick(pt, "hometel", "informtel", "mobile_phone_number"),
    dob: toThai(pick(pt, "birthday")),
    house: pick(sv, "addr") || pick(pt, "addrpart"),
    moo: pick(sv, "moo") || pick(pt, "moopart"),
    tambon,
    amphoe,
    province,
    onsetDate: toThai(pick(sv, "begin_date")),
    dxDate: toThai(pick(sv, "diagnosis_date")),
    reportDate: toThai(pick(sv, "report_date")),
    deathDate: toThai(deathRaw),
    ptype: toPtype(pick(sv, "department", "ptype"), pick(sv, "an"), pick(sv, "vn")),
    code506: pick(sv, "code506"),
    icd10: pick(sv, "pdx", "icd10"),
    status: pick(sv, "status_name"),
    reporter: pick(sv, "informname", "informer", "report_by", "staff"),
  };
}

export function getD506FormExtra(hn: string, reportDate = ""): Promise<D506FormExtra> {
  return cachedQuery(["d506-form", hn, reportDate], () => fetchFormExtra(hn, reportDate), TTL);
}
