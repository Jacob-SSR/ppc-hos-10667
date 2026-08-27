// lib/d506Sheets.service.ts
// อ่าน "ทะเบียนคุมผู้ป่วยโรคที่ต้องรายงานทางระบาดวิทยา (ระบบ D506)" จาก Google Sheet
// แล้ว normalize เป็น object ต่อ 1 ผู้ป่วย ให้หน้า /pages/d506-dashboard เอาไปทำ
// KPI / กราฟ / ตาราง / พิมพ์แบบ รง.506 เองฝั่ง client (เหมือนต้นฉบับ D506_Dashboard.html
// ที่ดึง CSV ตรง — แต่ย้ายมาอ่านผ่าน service account เพื่อไม่ต้องพึ่ง public proxy)
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
} from "@/lib/sheets";
import { cachedQuery, invalidate } from "./cache";

// ทะเบียน 506 อัปเดตเป็นรอบ (เจ้าหน้าที่กรอกมือ) → cache 5 นาทีพอ
const TTL = 300;

// sheet id เก็บใน .env (D506_SPREADSHEET_ID) — ไม่ hardcode ในซอร์ส
const SPREADSHEET_ID = process.env.D506_SPREADSHEET_ID ?? "";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface D506Row {
  seq: string;
  reportDate: string; // วันที่รับรายงาน (ตามที่กรอกในชีต)
  hn: string;
  pid: string; // เลขบัตรประชาชน
  prefix: string;
  fname: string;
  lname: string;
  sex: string; // ช / ญ (ตามชีต)
  dob: string;
  age: string;
  addr: string; // บ้านเลขที่/หมู่
  tambon: string;
  amphoe: string;
  province: string;
  onsetDate: string; // วันที่เริ่มป่วย
  disease: string; // โรคที่วินิจฉัย
  code506: string;
  icd10: string;
  ptype: string; // OPD / IPD
  labType: string; // ชนิดแลป
  lab: string; // ผล Lab (ยืนยัน/สงสัย/ไม่ยืนยัน)
  labSendDate: string;
  labResultDate: string;
  organism: string; // ชนิดเชื้อ/ผลเพาะเลี้ยง
  status: string; // สถานะผู้ป่วย
  dischargeDate: string;
  outcome: string; // ผลการรักษา
  d506Date: string; // วันที่ส่ง D506 API
  remark: string;
  death: string; // เสียชีวิต (ใช่/ไม่ ตามที่กรอก)
}

export interface D506Payload {
  updatedAt: string;
  spreadsheetId: string;
  sheetName: string;
  rowCount: number;
  rows: D506Row[];
  /** หัวคอลัมน์ที่อ่านได้ + คอลัมน์ที่จับคู่ได้ (ไว้ตรวจเวลาชีตสลับคอลัมน์) */
  header: string[];
  columns: Record<string, number>;
}

// ─── ตรวจจับคอลัมน์จาก header ─────────────────────────────────────────────────
// ชีตจริงสลับ/เพิ่ม/ลดคอลัมน์ได้ และหัวตารางมักเป็น 2 บรรทัด (merge cell) →
// ห้ามพึ่งลำดับคอลัมน์ ต้องอ่านจากชื่อหัวคอลัมน์เท่านั้น
// (ของเดิมใช้ regex แบบ ^ตำบล$ ซึ่งพลาดง่าย แล้ว fallback ไปใช้ลำดับ default
//  ผลคือช่อง "บ้านเลขที่" ได้วันเกิดมาแสดง / "จังหวัด" ได้ชื่ออำเภอ ฯลฯ)
type ColKey =
  | "seq" | "date" | "hn" | "pid" | "prefix" | "fname" | "lname" | "sex"
  | "dob" | "age" | "addr" | "tambon" | "amphoe" | "province" | "onsetDate"
  | "disease" | "code506" | "icd10" | "ptype" | "labType" | "lab"
  | "labSendDate" | "labResultDate" | "organism" | "status" | "dischargeDate"
  | "outcome" | "d506Date" | "remark" | "death";

type ColMap = Record<ColKey, number>;

const COL_KEYS: ColKey[] = [
  "seq", "date", "hn", "pid", "prefix", "fname", "lname", "sex", "dob", "age",
  "addr", "tambon", "amphoe", "province", "onsetDate", "disease", "code506",
  "icd10", "ptype", "labType", "lab", "labSendDate", "labResultDate",
  "organism", "status", "dischargeDate", "outcome", "d506Date", "remark",
  "death",
];

/** ลำดับคอลัมน์ตามฟอร์มทะเบียนมาตรฐาน — ใช้เฉพาะกรณีหา header ไม่เจอเลย */
function defaultCol(): ColMap {
  return {
    seq: 0, date: 1, hn: 2, pid: 3, prefix: 4, fname: 5, lname: 6, sex: 7,
    dob: 8, age: 9, addr: 10, tambon: 11, amphoe: 12, province: 13,
    onsetDate: 14, disease: 15, code506: 16, icd10: 17, ptype: 18,
    labType: 19, lab: 20, labSendDate: 21, labResultDate: 22, organism: 23,
    status: 24, dischargeDate: 25, outcome: 26, d506Date: 27, remark: 28,
    death: 29,
  };
}

function emptyCol(): ColMap {
  return Object.fromEntries(COL_KEYS.map((k) => [k, -1])) as ColMap;
}

/** เลข ๐-๙ (ชีตบางคอลัมน์ format เป็นเลขไทย) → 0-9 ไม่งั้น parse วันที่/ลำดับไม่ได้ */
export function thaiDigits(v: string): string {
  return v.replace(/[๐-๙]/g, (d) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d)));
}

const normHeader = (raw: string) =>
  thaiDigits(String(raw ?? ""))
    .replace(/[\n\r]/g, " ")
    .replace(/\s+/g, "")
    .toLowerCase();

/** กติกาจับคอลัมน์ — เรียงจาก "เฉพาะเจาะจงที่สุด" ลงมา อันแรกที่เข้าเงื่อนไขชนะ
 *  not = คำที่ถ้าเจอแล้วห้ามจับ (กันคอลัมน์ที่ชื่อคล้ายกันแย่งกัน) */
const RULES: { key: ColKey; re: RegExp; not?: RegExp }[] = [
  { key: "labResultDate", re: /(วันที่.*ได้ผล|ได้ผล.*(lab|แลป))/ },
  { key: "labSendDate", re: /ส่ง.*ตัวอย่าง|ตัวอย่าง.*ส่ง/ },
  { key: "labType", re: /ชนิด.*(lab|แลป)/ },
  { key: "organism", re: /ชนิดเชื้อ|ผลเพาะ|เพาะเลี้ยง/ },
  { key: "lab", re: /ผล.*(lab|แลป)/, not: /วันที่|ชนิด/ },
  { key: "d506Date", re: /d506/, not: /^รหัส/ },
  { key: "date", re: /รับรายงาน/ },
  { key: "onsetDate", re: /เริ่มป่วย/ },
  { key: "dischargeDate", re: /จำหน่าย/ },
  { key: "dob", re: /เกิด/ },
  { key: "age", re: /อายุ/ },
  { key: "seq", re: /ลำดับ|^#$|^ที่$/ },
  { key: "hn", re: /\bhn\b|^hn/ },
  { key: "pid", re: /บัตรประชาชน|เลขบัตร|ประชาชน|\bcid\b/ },
  { key: "prefix", re: /คำนำหน้า/ },
  { key: "lname", re: /สกุล/ },
  { key: "sex", re: /เพศ/ },
  { key: "addr", re: /บ้านเลขที่|ที่อยู่|เลขที่.*หมู่|^หมู่/ },
  { key: "tambon", re: /ตำบล/ },
  { key: "amphoe", re: /อำเภอ/ },
  { key: "province", re: /จังหวัด/ },
  { key: "code506", re: /506/, not: /icd|d506|วันที่/ },
  { key: "icd10", re: /icd/ },
  { key: "disease", re: /โรค/, not: /รหัส|icd|506/ },
  { key: "ptype", re: /ประเภท/ },
  { key: "status", re: /สถานะ/ },
  { key: "outcome", re: /ผลการรักษา|การรักษา/ },
  { key: "remark", re: /หมายเหตุ/ },
  { key: "death", re: /เสียชีวิต|ตาย/ },
  // "ชื่อ" กว้างสุด — ไว้ท้ายสุดกันไปแย่ง "ชื่อโรค" / "ชื่อผู้รายงาน"
  { key: "fname", re: /ชื่อ/, not: /โรค|ผู้รายงาน|สกุล|คำนำหน้า|เชื้อ/ },
];

function detectColumns(header: string[]): { col: ColMap; hits: number } {
  const col = emptyCol();
  const used = new Set<number>();
  const cells = header.map(normHeader);

  for (const rule of RULES) {
    if (col[rule.key] >= 0) continue;
    const idx = cells.findIndex(
      (c, i) =>
        c !== "" && !used.has(i) && rule.re.test(c) && !(rule.not?.test(c) ?? false),
    );
    if (idx >= 0) {
      col[rule.key] = idx;
      used.add(idx);
    }
  }
  return { col, hits: used.size };
}

// ─── โหลด + normalize ─────────────────────────────────────────────────────────
async function fetchD506(): Promise<D506Payload> {
  if (!SPREADSHEET_ID) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า D506_SPREADSHEET_ID ใน .env (Google Sheet id ของทะเบียน 506)",
    );
  }
  const sheets = await getSheetClient();

  // เลือกแท็บ "ทะเบียนคุมผู้ป่วย" ถ้ามี ไม่งั้นใช้แท็บแรก
  const titles = await getAllSheetTitles(sheets, SPREADSHEET_ID);
  const sheetName =
    titles.find((t) => /ทะเบียน/.test(t)) ?? titles[0] ?? "Sheet1";

  const raw = await getValues(sheets, SPREADSHEET_ID, `${sheetName}!A:AE`);

  // หา header row — แถวแรก (ใน 12 แถวแรก) ที่คอลัมน์ใดคอลัมน์หนึ่งมีคำว่า "ลำดับ"
  let headerIdx = raw.findIndex(
    (r, i) => i < 12 && r.some((c) => /ลำดับ/.test(toStr(c))),
  );
  if (headerIdx === -1) headerIdx = 0;

  // หัวตารางมักถูก merge เป็น 2 บรรทัด (เช่น "ที่อยู่ขณะเริ่มป่วย" คร่อม
  // ตำบล/อำเภอ/จังหวัด ที่อยู่บรรทัดล่าง) → รวมข้อความ 2 แถวเป็นหัวเดียวก่อนตรวจ
  const width = Math.max(...raw.slice(headerIdx, headerIdx + 3).map((r) => r.length), 0);
  const header = Array.from({ length: width }, (_, i) =>
    [raw[headerIdx]?.[i], raw[headerIdx + 1]?.[i]]
      .map((c) => toStr(c))
      .filter(Boolean)
      .join(" "),
  );

  // จับหัวคอลัมน์ได้น้อยเกินไป = แถวนั้นไม่ใช่หัวตารางจริง → ค่อยใช้ลำดับมาตรฐาน
  const detected = detectColumns(header);
  const col = detected.hits >= 6 ? detected.col : defaultCol();

  const at = (r: string[], i: number) => thaiDigits(toStr(i >= 0 ? r[i] : ""));

  const rows: D506Row[] = raw
    .slice(headerIdx + 1)
    .filter((r) => /^\d+$/.test(thaiDigits(toStr(r[col.seq]))))
    .map((r) => ({
      seq: at(r, col.seq),
      reportDate: at(r, col.date),
      hn: at(r, col.hn),
      pid: at(r, col.pid),
      prefix: at(r, col.prefix),
      fname: at(r, col.fname),
      lname: at(r, col.lname),
      sex: at(r, col.sex),
      dob: at(r, col.dob),
      age: at(r, col.age),
      addr: at(r, col.addr),
      tambon: at(r, col.tambon),
      amphoe: at(r, col.amphoe),
      province: at(r, col.province),
      onsetDate: at(r, col.onsetDate),
      disease: at(r, col.disease),
      code506: at(r, col.code506),
      icd10: at(r, col.icd10),
      ptype: at(r, col.ptype),
      labType: at(r, col.labType),
      lab: at(r, col.lab),
      labSendDate: at(r, col.labSendDate),
      labResultDate: at(r, col.labResultDate),
      organism: at(r, col.organism),
      status: at(r, col.status),
      dischargeDate: at(r, col.dischargeDate),
      outcome: at(r, col.outcome),
      d506Date: at(r, col.d506Date),
      remark: at(r, col.remark),
      death: at(r, col.death),
    }));

  return {
    updatedAt: new Date().toISOString(),
    spreadsheetId: SPREADSHEET_ID,
    sheetName,
    rowCount: rows.length,
    rows,
    header,
    columns: col as unknown as Record<string, number>,
  };
}

const CACHE_KEY = "d506-sheets";

export function getD506SheetsCached(): Promise<D506Payload> {
  return cachedQuery([CACHE_KEY, SPREADSHEET_ID], fetchD506, TTL);
}

/** ล้าง cache ทะเบียน 506 — ใช้ตอนกดรีโหลดเพื่อบังคับอ่าน Sheet ใหม่ */
export function invalidateD506Sheets(): Promise<void> {
  return invalidate(CACHE_KEY);
}
