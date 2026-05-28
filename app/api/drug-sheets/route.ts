// app/api/drug-sheets/route.ts
// ดึงข้อมูลผู้ป่วยยาเสพติดจาก Google Sheets แบบ real-time
// Spreadsheet ID เก็บใน .env: DRUG_SPREADSHEET_ID

import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.DRUG_SPREADSHEET_ID!;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DrugSheetRow {
  no: number;
  treatStatus: string;
  detailStatus: string;
  program: string;
  referralMethod: string;
  tambon: string;
  hn: string;
  prefix: string;
  firstName: string;
  lastName: string;
  age: number;
  v2Score: number;
  colorSeverity: string;
  isNew: boolean;
  startDate: string;
}

export interface DrugDashboardSummary {
  total: number;
  newPatients: number;
  oldPatients: number;
  inTreatment: number;
  followUp: number;
  discharged: number;
  treatComplete: number;
  dropout: number;
  retentionRate: number;
  male: number;
  female: number;
  avgAge: number;
  avgV2: number;
  minV2: number;
  maxV2: number;
  byTreatStatus: Record<string, number>;
  byDetailStatus: Record<string, number>;
  byProgram: Record<string, number>;
  byTambon: Record<string, number>;
  byReferral: Record<string, number>;
  byColor: Record<string, number>;
  byAgeGroup: Record<string, number>;
  byV2Group: Record<string, number>;
  byMonth: { month: string; count: number }[];
}

export interface DrugSheetsDashboardData {
  updatedAt: string;
  sheetName: string;
  summary: DrugDashboardSummary;
  rows: DrugSheetRow[];
  debug?: { headers: string[]; sampleRow: string[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}
function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function normalizeColor(raw: string): string {
  if (!raw) return "ไม่ระบุ";
  const r = raw.trim();
  if (r.includes("เขี") || r.includes("เขึ") || r.toLowerCase() === "green")
    return "เขียว";
  if (r.includes("ส้ม") || r.toLowerCase() === "orange") return "ส้ม";
  if (r.includes("เหลือง") || r.toLowerCase() === "yellow") return "เหลือง";
  if (r.includes("แดง") || r.toLowerCase() === "red") return "แดง";
  return r || "ไม่ระบุ";
}

// แปลงวันที่ทุกรูปแบบที่ Google Sheets ส่งมา → YYYY-MM-DD (ค.ศ.)
function parseDateStr(v: unknown): string {
  if (!v || v === "" || v === "-") return "";
  const s = String(v).trim();

  // D/M/YYYY หรือ DD/MM/YYYY (พ.ศ. หรือ ค.ศ.)
  const slashFmt = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashFmt) {
    const d = parseInt(slashFmt[1]);
    const m = parseInt(slashFmt[2]);
    let y = parseInt(slashFmt[3]);
    if (y > 2400) y -= 543;
    if (y < 1900 || y > 2200) return "";
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // D-M-YYYY หรือ DD-MM-YYYY
  const dashFmt = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashFmt) {
    const d = parseInt(dashFmt[1]);
    const m = parseInt(dashFmt[2]);
    let y = parseInt(dashFmt[3]);
    if (y > 2400) y -= 543;
    if (y < 1900 || y > 2200) return "";
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // YYYY-MM-DD (ISO)
  const isoFmt = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoFmt) {
    let y = parseInt(isoFmt[1]);
    if (y > 2400) y -= 543;
    if (y < 1900 || y > 2200) return "";
    return `${y}-${isoFmt[2]}-${isoFmt[3]}`;
  }

  // YYYY/MM/DD
  const isoSlash = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (isoSlash) {
    let y = parseInt(isoSlash[1]);
    if (y > 2400) y -= 543;
    if (y < 1900 || y > 2200) return "";
    return `${y}-${isoSlash[2]}-${isoSlash[3]}`;
  }

  // วันเดือนปีภาษาไทย: "1 ม.ค. 2568", "15 ธันวาคม 2567"
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
    มกราคม: "01",
    กุมภาพันธ์: "02",
    มีนาคม: "03",
    เมษายน: "04",
    พฤษภาคม: "05",
    มิถุนายน: "06",
    กรกฎาคม: "07",
    สิงหาคม: "08",
    กันยายน: "09",
    ตุลาคม: "10",
    พฤศจิกายน: "11",
    ธันวาคม: "12",
  };
  for (const [thMonth, numMonth] of Object.entries(thaiMonths)) {
    const escaped = thMonth.replace(/\./g, "\\.");
    const thaiRe = new RegExp(`(\\d{1,2})\\s*${escaped}\\s*(\\d{4})`);
    const thaiMatch = s.match(thaiRe);
    if (thaiMatch) {
      let y = parseInt(thaiMatch[2]);
      if (y > 2400) y -= 543;
      if (y < 1900 || y > 2200) continue;
      return `${y}-${numMonth}-${String(parseInt(thaiMatch[1])).padStart(2, "0")}`;
    }
  }

  // Excel serial number (Google Sheets formatted as number)
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

  return "";
}

function getMonthLabel(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return "";
  const y = parseInt(dateStr.slice(0, 4));
  const m = parseInt(dateStr.slice(5, 7));
  const MONTHS = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return "";
  return `${MONTHS[m - 1]}/${String(y + 543).slice(2)}`;
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

// ─── Parse rows จาก sheet ────────────────────────────────────────────────────
function parseRows(raw: string[][]): DrugSheetRow[] {
  if (raw.length < 2) return [];

  const header = raw[0].map((h) => toStr(h).toLowerCase().replace(/\s+/g, ""));

  // fuzzy column finder
  const col = (...keywords: string[]): number => {
    for (const kw of keywords) {
      const kwNorm = kw.toLowerCase().replace(/\s+/g, "");
      const i = header.findIndex((h) => h.includes(kwNorm));
      if (i >= 0) return i;
    }
    return -1;
  };

  const cNo = col("ลำดับ", "no");
  const cTreatStatus = col("สถานะ", "treatstatus");
  const cDetailStatus = col("รายละเอียด", "detail", "สถานะย่อย");
  const cProgram = col("โปรแกรม", "program", "hw", "imc");
  const cReferral = col("ส่งต่อ", "ช่องทาง", "referral", "นำส่ง");
  const cTambon = col("ตำบล", "tambon");
  const cHN = col("hn");
  const cPrefix = col("คำนำ", "prefix", "pname");
  const cFirst = col("ชื่อ", "firstname", "fname");
  const cLast = col("นามสกุล", "lastname", "lname");
  const cAge = col("อายุ", "age");
  const cV2 = col("v2", "คะแนน");
  const cColor = col("สี", "color", "ระดับ");
  const cIsNew = col("ใหม่", "isnew", "new");
  // วันที่เริ่ม — ลอง keyword หลายแบบ
  const cStartDate = col(
    "วันที่เริ่ม",
    "วันเริ่ม",
    "เริ่มรักษา",
    "admit",
    "วันรับ",
    "startdate",
    "start",
    "วันที่รับ",
    "บำบัด",
  );

  const rows: DrugSheetRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((c) => !c || !String(c).trim())) continue;

    const firstName = cFirst >= 0 ? toStr(r[cFirst]) : "";
    const hn = cHN >= 0 ? toStr(r[cHN]) : "";
    if (!firstName && !hn) continue;

    // พยายาม parse startDate จากทุก column ที่มีวันที่
    let startDate = cStartDate >= 0 ? parseDateStr(r[cStartDate]) : "";
    // ถ้ายังไม่ได้ ลองทุก cell ในแถวที่ดูเหมือนวันที่
    if (!startDate) {
      for (let j = 0; j < r.length; j++) {
        const parsed = parseDateStr(r[j]);
        if (parsed && parsed >= "2020-") {
          // ปี 2020+ น่าจะเป็นวันที่รับบำบัด
          startDate = parsed;
          break;
        }
      }
    }

    rows.push({
      no: cNo >= 0 ? toNum(r[cNo]) || i : i,
      treatStatus: cTreatStatus >= 0 ? toStr(r[cTreatStatus]) : "",
      detailStatus: cDetailStatus >= 0 ? toStr(r[cDetailStatus]) : "",
      program: cProgram >= 0 ? toStr(r[cProgram]) : "",
      referralMethod: cReferral >= 0 ? toStr(r[cReferral]) : "",
      tambon: cTambon >= 0 ? toStr(r[cTambon]) : "",
      hn,
      prefix: cPrefix >= 0 ? toStr(r[cPrefix]) : "",
      firstName,
      lastName: cLast >= 0 ? toStr(r[cLast]) : "",
      age: cAge >= 0 ? toNum(r[cAge]) : 0,
      v2Score: cV2 >= 0 ? toNum(r[cV2]) : 0,
      colorSeverity: cColor >= 0 ? normalizeColor(toStr(r[cColor])) : "ไม่ระบุ",
      isNew:
        cIsNew >= 0
          ? ["ใหม่", "new", "y", "yes", "1", "true"].includes(
              toStr(r[cIsNew]).toLowerCase(),
            )
          : false,
      startDate,
    });
  }

  return rows;
}

// ─── Build summary ────────────────────────────────────────────────────────────
function buildSummary(rows: DrugSheetRow[]): DrugDashboardSummary {
  const total = rows.length;
  const newPatients = rows.filter((r) => r.isNew).length;
  const inTreatment = rows.filter((r) => r.treatStatus === "บำบัด").length;
  const followUp = rows.filter((r) => r.treatStatus === "ติดตาม").length;
  const discharged = rows.filter((r) => r.treatStatus === "จำหน่าย").length;
  const treatComplete = rows.filter(
    (r) => r.detailStatus === "treat ครบ",
  ).length;
  const dropout = rows.filter((r) => r.detailStatus === "Dropout").length;

  const malePrefixes = ["นาย", "เด็กชาย", "ด.ช."];
  const femalePrefixes = ["นาง", "นางสาว", "น.ส.", "เด็กหญิง", "ด.ญ."];
  const male = rows.filter((r) => malePrefixes.includes(r.prefix)).length;
  const female = rows.filter((r) => femalePrefixes.includes(r.prefix)).length;

  const ages = rows.map((r) => r.age).filter((a) => a > 0);
  const avgAge =
    ages.length > 0
      ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
      : 0;

  const v2s = rows.map((r) => r.v2Score).filter((v) => v > 0);
  const avgV2 =
    v2s.length > 0
      ? Math.round((v2s.reduce((s, v) => s + v, 0) / v2s.length) * 10) / 10
      : 0;
  const minV2 = v2s.length > 0 ? Math.min(...v2s) : 0;
  const maxV2 = v2s.length > 0 ? Math.max(...v2s) : 0;

  const countBy = (key: keyof DrugSheetRow) => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      const v = String(r[key] ?? "ไม่ระบุ").trim() || "ไม่ระบุ";
      m[v] = (m[v] || 0) + 1;
    });
    return m;
  };

  const byAgeGroup: Record<string, number> = {
    "< 18 ปี": 0,
    "18-25 ปี": 0,
    "26-35 ปี": 0,
    "36-45 ปี": 0,
    "> 45 ปี": 0,
  };
  rows.forEach((r) => {
    if (!r.age) return;
    if (r.age < 18) byAgeGroup["< 18 ปี"]++;
    else if (r.age <= 25) byAgeGroup["18-25 ปี"]++;
    else if (r.age <= 35) byAgeGroup["26-35 ปี"]++;
    else if (r.age <= 45) byAgeGroup["36-45 ปี"]++;
    else byAgeGroup["> 45 ปี"]++;
  });

  const byV2Group: Record<string, number> = {
    "เสพ (1-8)": 0,
    "ติดน้อย (9-16)": 0,
    "ติดปาน (17-26)": 0,
    "ติดมาก (27+)": 0,
  };
  rows.forEach((r) => {
    if (!r.v2Score) return;
    if (r.v2Score <= 8) byV2Group["เสพ (1-8)"]++;
    else if (r.v2Score <= 16) byV2Group["ติดน้อย (9-16)"]++;
    else if (r.v2Score <= 26) byV2Group["ติดปาน (17-26)"]++;
    else byV2Group["ติดมาก (27+)"]++;
  });

  // Monthly trend — นับจาก startDate
  const monthMap: Record<string, number> = {};
  rows.forEach((r) => {
    const lbl = getMonthLabel(r.startDate);
    if (lbl) monthMap[lbl] = (monthMap[lbl] || 0) + 1;
  });
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => {
      // sort by YYYY-MM derived from label (rough sort)
      return a.localeCompare(b, "th");
    })
    .map(([month, count]) => ({ month, count }));

  // Normalize referral
  const rawReferral = countBy("referralMethod");
  const byReferral: Record<string, number> = {};
  Object.entries(rawReferral).forEach(([k, v]) => {
    const clean = k.replace(/์{2,}/g, "์").trim() || "ไม่ระบุ";
    byReferral[clean] = (byReferral[clean] || 0) + v;
  });

  return {
    total,
    newPatients,
    oldPatients: total - newPatients,
    inTreatment,
    followUp,
    discharged,
    treatComplete,
    dropout,
    retentionRate:
      total > 0 ? Math.round((inTreatment / total) * 1000) / 10 : 0,
    male,
    female,
    avgAge,
    avgV2,
    minV2,
    maxV2,
    byTreatStatus: countBy("treatStatus"),
    byDetailStatus: countBy("detailStatus"),
    byProgram: countBy("program"),
    byTambon: countBy("tambon"),
    byReferral,
    byColor: countBy("colorSeverity"),
    byAgeGroup,
    byV2Group,
    byMonth,
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    if (!SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า DRUG_SPREADSHEET_ID ใน .env" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(req.url);
    const debug = searchParams.get("debug") === "1";

    const sheets = await getSheetClient();

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const allSheets = meta.data.sheets ?? [];

    // เลือก sheet: หาที่มีชื่อเกี่ยวกับผู้ป่วย/ข้อมูล หรือใช้แผ่นแรก
    const targetSheet =
      allSheets.find((s) => {
        const title = (s.properties?.title ?? "").toLowerCase();
        return (
          title.includes("ผู้ป่วย") ||
          title.includes("patient") ||
          title.includes("ข้อมูล") ||
          title.includes("data") ||
          title.includes("drug")
        );
      })?.properties?.title ??
      allSheets[0]?.properties?.title ??
      "Sheet1";

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${targetSheet}!A:AJ`,
    });

    const raw = (res.data.values ?? []) as string[][];
    const rows = parseRows(raw);
    const summary = buildSummary(rows);

    const result: DrugSheetsDashboardData = {
      updatedAt: new Date().toISOString(),
      sheetName: targetSheet,
      summary,
      rows,
    };

    // Debug mode: ส่ง header + sample row กลับมาด้วย
    if (debug && raw.length > 0) {
      result.debug = {
        headers: raw[0],
        sampleRow: raw[1] ?? [],
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("DrugSheets error:", err);
    return NextResponse.json(
      {
        error:
          "ดึงข้อมูลจาก Google Sheets ไม่สำเร็จ: " + (err as Error).message,
      },
      { status: 500 },
    );
  }
}
