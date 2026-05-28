// app/api/stroke-sheets/route.ts
// ดึงข้อมูลผู้ป่วย Stroke จาก Google Sheets แบบ real-time
// Spreadsheet ID เก็บใน .env: STROKE_SPREADSHEET_ID

import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.STROKE_SPREADSHEET_ID!;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface StrokeSheetRow {
  id: number;
  no: number | null;
  hn: string;
  name: string;
  age: number | null;
  comorbidity: string;
  date: string; // "YYYY-MM-DD" CE
  onset: string;
  type: string; // "FAST TRACT" | "Non-FAST TRACT"
  diagnosis: string;
  nihss: number | null;
  dtx: string;
  ekg: string;
  ems: string;
  status: string;
  department: string;
  district: string;
  definiteDx: string;
  ctScan: string;
  rtPA: string;
  outcome: string;
  note: string;
  isIMC: boolean;
}

export interface StrokeSheetsDashboardData {
  updatedAt: string;
  sheetName: string;
  rows: StrokeSheetRow[];
  debug?: { headers: string[]; sampleRow: string[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function toNum(v: unknown): number | null {
  if (v == null || v === "" || v === "-") return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

// รองรับ datetime string จาก Google Sheets API ซึ่งส่งเป็น string เสมอ
// รูปแบบที่พบ: "2023-10-02T00:00:00.000Z", "2/10/2023", "2567-10-02", serialNumber
function parseDateStr(v: unknown): string {
  if (!v || v === "" || v === "-") return "";
  const s = String(v).trim();

  // ISO datetime: "2023-10-02T00:00:00.000Z"
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    let y = parseInt(iso[1]);
    if (y > 2400) y -= 543;
    if (y < 1900 || y > 2200) return "";
    return `${y}-${iso[2]}-${iso[3]}`;
  }

  // D/M/YYYY หรือ DD/MM/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const d = parseInt(slash[1]);
    const m = parseInt(slash[2]);
    let y = parseInt(slash[3]);
    if (y > 2400) y -= 543;
    if (y < 1900 || y > 2200) return "";
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // D-M-YYYY
  const dash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    let y = parseInt(dash[3]);
    if (y > 2400) y -= 543;
    if (y < 1900 || y > 2200) return "";
    return `${y}-${dash[2].padStart(2, "0")}-${dash[1].padStart(2, "0")}`;
  }

  // Excel serial number (Google Sheets ส่งเป็น number ถ้า column format=Date)
  const num = Number(s);
  if (!isNaN(num) && num > 25569 && num < 55000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    let y = date.getUTCFullYear();
    if (y > 2400) y -= 543;
    if (y < 1900 || y > 2200) return "";
    const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

  // วันที่ภาษาไทย เช่น "2 ต.ค. 2566"
  const thaiMonths: Record<string, string> = {
    "ม.ค.": "01",
    "ก.พ.": "02",
    "มี.ค.": "03",
    "เม.ย.": "04",
    "พ.ค.": "05",
    "มิ.ย.": "06",
    "ก.ค.": "07",
    "ส.ค.": "08",
    "ก.ย.": "09",
    "ต.ค.": "10",
    "พ.ย.": "11",
    "ธ.ค.": "12",
  };
  for (const [th, num2] of Object.entries(thaiMonths)) {
    const re = new RegExp(
      `(\\d{1,2})\\s*${th.replace(".", "\\.")}\\s*(\\d{4})`,
    );
    const m = s.match(re);
    if (m) {
      let y = parseInt(m[2]);
      if (y > 2400) y -= 543;
      if (y < 1900 || y > 2200) continue;
      return `${y}-${num2}-${String(parseInt(m[1])).padStart(2, "0")}`;
    }
  }

  return "";
}

// ─── Google Sheets client ─────────────────────────────────────────────────────
async function getSheetClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

// ─── Column header map (ตรงกับไฟล์จริง) ─────────────────────────────────────
// Header row จากไฟล์: ลำดับ, HN, คำนำหน้า, ชื่อ-นามสกุล, อายุ, โรคประจำตัว,
// วันที่รับบริการ, Onset time, Type of Stoke, Diagnosis, NIHSS, DTX,
// EKG 12 leads, บริการด้วย 1669, สถานะผู้ป่วย, แผนกที่วินิจฉัย,
// เขตที่อยู่อาศัย, Definite diagnosis, ผล CT brain scan, ได้รับา rtPA,
// Outcome, หมายเหตุ

function parseRows(raw: string[][]): StrokeSheetRow[] {
  if (raw.length < 2) return [];

  // หา header row — บางไฟล์อาจมี row ว่างก่อน
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    const row = raw[i];
    if (row.some((c) => /ชื่อ|HN|วันที่|Stroke|NIHSS/i.test(toStr(c)))) {
      headerRowIdx = i;
      break;
    }
  }

  const header = raw[headerRowIdx].map((h) =>
    toStr(h).toLowerCase().replace(/\s+/g, ""),
  );

  const col = (...kws: string[]): number => {
    for (const kw of kws) {
      const norm = kw.toLowerCase().replace(/\s+/g, "");
      const i = header.findIndex((h) => h.includes(norm));
      if (i >= 0) return i;
    }
    return -1;
  };

  const cNo = col("ลำดับ");
  const cHN = col("hn");
  const cPrefix = col("คำนำหน้า");
  const cName = col("ชื่อ-นามสกุล", "ชื่อนามสกุล");
  const cAge = col("อายุ");
  const cComorbidity = col("โรคประจำตัว");
  const cDate = col("วันที่รับบริการ", "วันที่");
  const cOnset = col("onsettime", "onset");
  const cType = col("typeofstoke", "type");
  const cDiag = col("diagnosis");
  const cNIHSS = col("nihss");
  const cDTX = col("dtx");
  const cEKG = col("ekg");
  const cEMS = col("1669", "ems");
  const cStatus = col("สถานะผู้ป่วย", "สถานะ");
  const cDept = col("แผนกที่วินิจฉัย", "แผนก");
  const cDistrict = col("เขตที่อยู่อาศัย", "เขต");
  const cDefiniteDx = col("definitediagnosis", "definitedx");
  const cCT = col("ctbrain", "ct");
  const cRtPA = col("rtpa", "ได้รับา");
  const cOutcome = col("outcome");
  const cNote = col("หมายเหตุ");

  const rows: StrokeSheetRow[] = [];
  let id = 0;

  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((c) => !c || !String(c).trim())) continue;

    const name = cName >= 0 ? toStr(r[cName]) : "";
    const hnRaw = cHN >= 0 ? toStr(r[cHN]) : "";

    // skip แถวที่ไม่ใช่ข้อมูลผู้ป่วย (เช่น summary rows ด้านขวา)
    if (!name && !hnRaw) continue;
    // skip แถวที่ดูเหมือน header ซ้ำ
    if (/ชื่อ|name|ลำดับ/i.test(name)) continue;

    // ตรวจ IMC จาก note หรือ definiteDx
    const note = cNote >= 0 ? toStr(r[cNote]) : "";
    const definiteDx = cDefiniteDx >= 0 ? toStr(r[cDefiniteDx]) : "";
    const isIMC =
      /imc/i.test(note) || /imc/i.test(definiteDx) || /refer.?back/i.test(note);

    // ตรวจ rtPA — หลายไฟล์ใช้ "ได้รับา rtPA" หรือ "ได้รับ rtPA"
    let rtPA = cRtPA >= 0 ? toStr(r[cRtPA]) : "";
    if (!rtPA) {
      // scan หา "Yes" หรือ "No" ใน columns ที่เหลือ
      for (let j = 18; j <= 21; j++) {
        const v = toStr(r[j]);
        if (v === "Yes" || v === "No") {
          rtPA = v;
          break;
        }
      }
    }

    // HN: อาจเป็น float เช่น 460013741.0 → ตัด .0 ออก
    const hnClean = hnRaw.replace(/\.0$/, "");

    // Prefix: บางแถวมีสูตร =left(D2,3) ให้ข้ามไป extract จาก name แทน
    let prefix = cPrefix >= 0 ? toStr(r[cPrefix]) : "";
    if (prefix.startsWith("=")) {
      // extract จากชื่อ 3 ตัวแรก
      prefix = name.slice(0, 3);
    }

    rows.push({
      id: id++,
      no: cNo >= 0 ? toNum(r[cNo]) : null,
      hn: hnClean,
      name,
      age: cAge >= 0 ? toNum(r[cAge]) : null,
      comorbidity: cComorbidity >= 0 ? toStr(r[cComorbidity]) : "",
      date: cDate >= 0 ? parseDateStr(r[cDate]) : "",
      onset: cOnset >= 0 ? toStr(r[cOnset]) : "",
      type: cType >= 0 ? toStr(r[cType]) : "",
      diagnosis: cDiag >= 0 ? toStr(r[cDiag]) : "",
      nihss: cNIHSS >= 0 ? toNum(r[cNIHSS]) : null,
      dtx: cDTX >= 0 ? toStr(r[cDTX]) : "",
      ekg: cEKG >= 0 ? toStr(r[cEKG]) : "",
      ems: cEMS >= 0 ? toStr(r[cEMS]) : "",
      status: cStatus >= 0 ? toStr(r[cStatus]) : "",
      department: cDept >= 0 ? toStr(r[cDept]) : "",
      district: cDistrict >= 0 ? toStr(r[cDistrict]) : "",
      definiteDx,
      ctScan: cCT >= 0 ? toStr(r[cCT]) : "",
      rtPA,
      outcome: cOutcome >= 0 ? toStr(r[cOutcome]) : "",
      note,
      isIMC,
    });
  }

  return rows;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    if (!SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า STROKE_SPREADSHEET_ID ใน .env" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(req.url);
    const debug = searchParams.get("debug") === "1";

    const sheets = await getSheetClient();

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const targetSheet = meta.data.sheets?.[0]?.properties?.title ?? "Sheet1";

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${targetSheet}!A:V`, // คอลัมน์ A–V ครอบคลุม 22 คอลัมน์
    });

    const raw = (res.data.values ?? []) as string[][];
    const rows = parseRows(raw);

    const result: StrokeSheetsDashboardData = {
      updatedAt: new Date().toISOString(),
      sheetName: targetSheet,
      rows,
    };

    if (debug && raw.length > 0) {
      result.debug = {
        headers: raw[0],
        sampleRow: raw[1] ?? [],
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("StrokeSheets error:", err);
    return NextResponse.json(
      {
        error:
          "ดึงข้อมูลจาก Google Sheets ไม่สำเร็จ: " + (err as Error).message,
      },
      { status: 500 },
    );
  }
}
