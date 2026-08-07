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
import { cachedQuery } from "./cache";

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
}

// ─── ตรวจจับคอลัมน์จาก header ─────────────────────────────────────────────────
// ชีตจริงสลับลำดับคอลัมน์ได้ (เช่น ชนิดแลป มาก่อน/หลัง ผล Lab) → ตรวจจากชื่อหัวคอลัมน์
// พอร์ตตรรกะมาจาก autoDetectColumns() ใน D506_Dashboard.html
interface ColMap {
  seq: number;
  date: number;
  hn: number;
  pid: number;
  prefix: number;
  fname: number;
  lname: number;
  sex: number;
  dob: number;
  age: number;
  addr: number;
  tambon: number;
  amphoe: number;
  province: number;
  onsetDate: number;
  disease: number;
  code506: number;
  icd10: number;
  ptype: number;
  labType: number;
  lab: number;
  labSendDate: number;
  labResultDate: number;
  organism: number;
  status: number;
  dischargeDate: number;
  outcome: number;
  d506Date: number;
  remark: number;
  death: number;
}

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

function detectColumns(header: string[]): ColMap {
  const col = defaultCol();
  const norm = (raw: string) =>
    raw.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  header.forEach((raw, idx) => {
    const c = norm(raw);
    if (!c) return;
    if (/ชนิด\s*lab|ชนิดแลป/i.test(c)) return void (col.labType = idx);
    if (/ชนิดเชื้อ|ผลเพาะ/i.test(c)) return void (col.organism = idx);
    if (/^HN$/i.test(c)) return void (col.hn = idx);
    if (/เลขบัตร|บัตรประชาชน/i.test(c)) return void (col.pid = idx);
    if (/คำนำหน้า/i.test(c)) return void (col.prefix = idx);
    if (/^ชื่อ$/.test(c)) return void (col.fname = idx);
    if (/^สกุล$/.test(c)) return void (col.lname = idx);
    if (/^เพศ$/.test(c)) return void (col.sex = idx);
    if (/เกิด/i.test(c)) return void (col.dob = idx);
    if (/อายุ/i.test(c)) return void (col.age = idx);
    if (/บ้านเลขที่|ที่อยู่/i.test(c)) return void (col.addr = idx);
    if (/^ตำบล$/.test(c)) return void (col.tambon = idx);
    if (/^อำเภอ$/.test(c)) return void (col.amphoe = idx);
    if (/^จังหวัด$/.test(c)) return void (col.province = idx);
    if (/โรค.*วินิจฉัย|วินิจฉัย.*โรค/i.test(c)) return void (col.disease = idx);
    if (/รหัส.*506/i.test(c) && !/ICD/i.test(c)) return void (col.code506 = idx);
    if (/ICD/i.test(c)) return void (col.icd10 = idx);
    if (/ประเภท.*ผู้ป่วย/i.test(c)) return void (col.ptype = idx);
    if (/สถานะ.*ผู้ป่วย/i.test(c)) return void (col.status = idx);
    if (/จำหน่าย/i.test(c) && /วันที่/i.test(c))
      return void (col.dischargeDate = idx);
    if (/ผล.*การรักษา|การรักษา/i.test(c)) return void (col.outcome = idx);
    if (/D506/i.test(c) && /ส่ง|วันที่/i.test(c))
      return void (col.d506Date = idx);
    if (/หมายเหตุ/i.test(c)) return void (col.remark = idx);
    if (/เสียชีวิต/i.test(c)) return void (col.death = idx);
    // วันที่ได้ผล Lab ต้องตรวจก่อน "ผล Lab" ไม่งั้น regex ผล Lab จับผิด
    if (/วันที่.*ได้ผล|ได้ผล.*lab/i.test(c))
      return void (col.labResultDate = idx);
    if (/ส่งตัวอย่าง|ส่ง.*ตัวอย่าง/i.test(c))
      return void (col.labSendDate = idx);
    if (/^ผล.*lab/i.test(c) && !/วันที่/i.test(c) && !/ชนิด/i.test(c))
      return void (col.lab = idx);
    if (/ลำดับ/i.test(c)) return void (col.seq = idx);
  });

  // วันที่รับรายงาน / วันที่เริ่มป่วย — จับแยกรอบเพราะลำดับเงื่อนไขสำคัญ
  header.forEach((raw, idx) => {
    const c = norm(raw);
    if (/วันที่.*รับรายงาน|รับรายงาน/i.test(c)) col.date = idx;
    else if (/วันที่.*เริ่มป่วย|เริ่มป่วย/i.test(c)) col.onsetDate = idx;
  });

  return col;
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

  const col = detectColumns(raw[headerIdx] ?? []);
  const at = (r: string[], i: number) => toStr(i >= 0 ? r[i] : "");

  const rows: D506Row[] = raw
    .slice(headerIdx + 1)
    .filter((r) => /^\d+$/.test(toStr(r[col.seq])))
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
  };
}

export function getD506SheetsCached(): Promise<D506Payload> {
  return cachedQuery(["d506-sheets", SPREADSHEET_ID], fetchD506, TTL);
}
