import { NextResponse } from "next/server";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  toNum,
  countBy,
  parseDate,
  sheetsError,
} from "@/lib/sheets";

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

// ─── Helpers เฉพาะ drug ───────────────────────────────────────────────────────
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

// month label เฉพาะ drug: "ม.ค./68" (ต่างจาก monthLabelShort กลางที่เป็น "ม.ค. 68")
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

    // พยายาม parse startDate จาก column ที่ระบุ
    let startDate =
      cStartDate >= 0 ? parseDate(r[cStartDate], { validate: true }) : "";
    // ถ้ายังไม่ได้ ลองทุก cell ในแถวที่ดูเหมือนวันที่
    if (!startDate) {
      for (let j = 0; j < r.length; j++) {
        const parsed = parseDate(r[j], { validate: true });
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
    .sort(([a], [b]) => a.localeCompare(b, "th"))
    .map(([month, count]) => ({ month, count }));

  // Normalize referral
  const rawReferral = countBy(rows, "referralMethod");
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
    byTreatStatus: countBy(rows, "treatStatus"),
    byDetailStatus: countBy(rows, "detailStatus"),
    byProgram: countBy(rows, "program"),
    byTambon: countBy(rows, "tambon"),
    byReferral,
    byColor: countBy(rows, "colorSeverity"),
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

    // เลือก sheet: หาที่มีชื่อเกี่ยวกับผู้ป่วย/ข้อมูล หรือใช้แผ่นแรก
    const allTitles = await getAllSheetTitles(sheets, SPREADSHEET_ID);
    const targetSheet =
      allTitles.find((title) => {
        const t = title.toLowerCase();
        return (
          t.includes("ผู้ป่วย") ||
          t.includes("patient") ||
          t.includes("ข้อมูล") ||
          t.includes("data") ||
          t.includes("drug")
        );
      }) ??
      allTitles[0] ??
      "Sheet1";

    const raw = await getValues(sheets, SPREADSHEET_ID, `${targetSheet}!A:AJ`);
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
    return sheetsError(err, "DrugSheets");
  }
}
