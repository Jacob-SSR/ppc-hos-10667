// lib/strokeSheets.service.ts
// Parser ของทะเบียน Stroke — ย้ายมาจาก app/api/stroke-sheets/route.ts
// เพื่อให้ /api/stroke-sheets และ /api/stroke-map ใช้ข้อมูล (และ cache) ชุดเดียวกัน
import { cachedQuery } from "./cache";
import {
  getSheetClient,
  getFirstSheetTitle,
  getValues,
  toStr,
  toNumOrNull,
  parseDate,
} from "@/lib/sheets";

const SPREADSHEET_ID = process.env.STROKE_SPREADSHEET_ID!;

const TTL_SECONDS = 600;
const CACHE_KEY = "stroke-sheets";

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
      no: cNo >= 0 ? toNumOrNull(r[cNo]) : null,
      hn: hnClean,
      name,
      age: cAge >= 0 ? toNumOrNull(r[cAge]) : null,
      comorbidity: cComorbidity >= 0 ? toStr(r[cComorbidity]) : "",
      date: cDate >= 0 ? parseDate(r[cDate], { validate: true }) : "",
      onset: cOnset >= 0 ? toStr(r[cOnset]) : "",
      type: cType >= 0 ? toStr(r[cType]) : "",
      diagnosis: cDiag >= 0 ? toStr(r[cDiag]) : "",
      nihss: cNIHSS >= 0 ? toNumOrNull(r[cNIHSS]) : null,
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

/** ดึงจาก Sheets + parse — เก็บก้อนเดียวใน cache (รวม debug info เสมอ) */
async function buildStrokeSheetsData(): Promise<StrokeSheetsDashboardData> {
  const sheets = await getSheetClient();
  const targetSheet = await getFirstSheetTitle(sheets, SPREADSHEET_ID);
  const raw = await getValues(sheets, SPREADSHEET_ID, `${targetSheet}!A:V`);

  const rows = parseRows(raw);

  return {
    updatedAt: new Date().toISOString(),
    sheetName: targetSheet,
    rows,
    debug:
      raw.length > 0 ? { headers: raw[0], sampleRow: raw[1] ?? [] } : undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
/** payload เต็ม (rows + debug) ผ่าน cache กลาง — key เดิม "stroke-sheets"
 *  ทั้ง /api/stroke-sheets และ /api/stroke-map เรียกตัวนี้ → แชร์ cache ก้อนเดียว */
export async function getStrokeSheetsCached(): Promise<StrokeSheetsDashboardData> {
  return cachedQuery([CACHE_KEY], buildStrokeSheetsData, TTL_SECONDS);
}
