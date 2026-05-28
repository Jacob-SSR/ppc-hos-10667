// app/api/accident-sheets/route.ts
// ดึงข้อมูลอุบัติเหตุจาก Google Sheets แบบ real-time
// Spreadsheet ID: 1XlHb3jU93RzZ7kkE-LY1vL2sFRTiesh2nxRw9vGDeWY

import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.ACCIDENT_SPREADSHEET_ID!;

// ─── หัวตารางเหมือนกับที่ parseXlsx ใช้ (ภาษาไทย) ──────────────────────────
const COLUMN_MAP: Record<string, keyof AccidentRow> = {
  ลำดับ: "no",
  HN: "hn",
  อายุ: "age",
  เพศ: "sex",
  วันที่มารับการรักษา: "treatDate",
  วันที่เกิดเหตุ: "accidentDate",
  เวลาที่เกิด: "timeSlot",
  เอกสารพรบ: "prb",
  สิทธิการรักษา: "rights",
  ประเภทพาหนะ: "vehicle",
  ระดับความรุนแรง: "severity",
  ประเภท: "transport",
  ถนนที่เกิดเหตุ: "road",
  ตำบลที่เกิดเหตุ: "tambon",
  "respone time กรณีมีออก EMS": "responseTime",
  วินิจฉัยทางการแพทย์: "diagnosis",
  "mechanismof accident (รายละเอียดการบาดเจ็บ)": "mechanism",
  สถานะ: "status",
  ดื่มสุรา: "alcohol",
  การป้องกัน: "protection",
  ปัจจัยเสี่ยง: "riskFactor",
  ตรวจแอลกอฮอล์: "alcoholTest",
  ที่อยู่: "address",
  status: "finalStatus",
  หมายเหตุ: "note",
};

export interface AccidentRow {
  no: number;
  hn: string;
  age: number;
  sex: string;
  treatDate: string;
  accidentDate: string;
  timeSlot: string;
  prb: string;
  rights: string;
  vehicle: string;
  severity: string;
  transport: string;
  road: string;
  tambon: string;
  responseTime: string;
  diagnosis: string;
  mechanism: string;
  status: string;
  alcohol: string;
  protection: string;
  riskFactor: string;
  alcoholTest: string;
  address: string;
  finalStatus: string;
  note: string;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

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

function parseRows(rawRows: string[][]): {
  rows: AccidentRow[];
  sheetName: string;
} {
  if (rawRows.length < 2) return { rows: [], sheetName: "Sheet1" };

  const header = rawRows[0].map((h) => toStr(h));

  // build index map
  const colIndex: Partial<Record<keyof AccidentRow, number>> = {};
  header.forEach((h, i) => {
    const key = COLUMN_MAP[h];
    if (key) colIndex[key] = i;
  });

  const get = (row: string[], key: keyof AccidentRow): string => {
    const idx = colIndex[key];
    return idx !== undefined ? toStr(row[idx]) : "";
  };

  const rows: AccidentRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    // skip empty rows
    if (!row || row.every((c) => !c || !String(c).trim())) continue;

    const hn = get(row, "hn");
    const treatDate = get(row, "treatDate");
    if (!hn && !treatDate) continue;

    rows.push({
      no: toNum(get(row, "no")) || i,
      hn,
      age: toNum(get(row, "age")),
      sex: get(row, "sex"),
      treatDate,
      accidentDate: get(row, "accidentDate"),
      timeSlot: get(row, "timeSlot"),
      prb: get(row, "prb"),
      rights: get(row, "rights"),
      vehicle: get(row, "vehicle"),
      severity: get(row, "severity"),
      transport: get(row, "transport"),
      road: get(row, "road"),
      tambon: get(row, "tambon"),
      responseTime: get(row, "responseTime"),
      diagnosis: get(row, "diagnosis"),
      mechanism: get(row, "mechanism"),
      status: get(row, "status"),
      alcohol: get(row, "alcohol"),
      protection: get(row, "protection"),
      riskFactor: get(row, "riskFactor"),
      alcoholTest: get(row, "alcoholTest"),
      address: get(row, "address"),
      finalStatus: get(row, "finalStatus"),
      note: get(row, "note"),
    });
  }

  return { rows, sheetName: "Google Sheets" };
}

function buildSummary(rows: AccidentRow[]) {
  const total = rows.length;
  const dead = rows.filter((r) => r.status === "Dead").length;
  const admit = rows.filter((r) => r.status === "Admit").length;
  const refer = rows.filter((r) =>
    r.status.toLowerCase().includes("refer"),
  ).length;
  const followUp = rows.filter((r) => r.status === "follow up").length;
  const dc = rows.filter((r) => r.status === "D/C").length;
  const male = rows.filter((r) => r.sex === "ชาย").length;
  const female = rows.filter((r) => r.sex === "หญิง").length;
  const drinkCount = rows.filter((r) => r.alcohol === "ดื่ม").length;
  const motorcycleCount = rows.filter(
    (r) => r.vehicle === "จักรยานยนต์",
  ).length;
  const helmetWorn = rows.filter(
    (r) =>
      r.protection.includes("สวมหมวกนิรภัย") && !r.protection.includes("ไม่"),
  ).length;
  const helmetNot = rows.filter((r) =>
    r.protection.includes("ไม่สวมหมวก"),
  ).length;

  const ages = rows.map((r) => r.age).filter((a) => a > 0);
  const avgAge =
    ages.length > 0
      ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
      : 0;
  const minAge = ages.length > 0 ? Math.min(...ages) : 0;
  const maxAge = ages.length > 0 ? Math.max(...ages) : 0;

  const count = (arr: AccidentRow[], key: keyof AccidentRow) => {
    const m: Record<string, number> = {};
    arr.forEach((r) => {
      const v = String(r[key] || "ไม่ระบุ").trim() || "ไม่ระบุ";
      m[v] = (m[v] || 0) + 1;
    });
    return m;
  };

  const byVehicle = count(rows, "vehicle");
  const bySeverity = count(rows, "severity");
  const byTambon = count(rows, "tambon");
  const byStatus = count(rows, "status");
  const byProtection = count(rows, "protection");
  const byRoad = count(rows, "road");

  const byTimeSlot: Record<string, number> = {};
  rows.forEach((r) => {
    const t = r.timeSlot.trim() || "ไม่ระบุ";
    const key =
      t.includes("0.00-4") || t.includes("00:00")
        ? "00:00–04:00"
        : t.includes("4.00-") || t.includes("04:")
          ? "04:00–08:00"
          : (t.includes("8") || t.includes("08")) && t.includes("12")
            ? "08:00–12:00"
            : t.includes("12") && t.includes("16")
              ? "12:00–16:00"
              : t.includes("16")
                ? "16:00–20:00"
                : t.includes("20")
                  ? "20:00–24:00"
                  : t || "ไม่ระบุ";
    byTimeSlot[key] = (byTimeSlot[key] || 0) + 1;
  });

  const AGE_GROUPS = ["<15", "15-24", "25-34", "35-44", "45-54", "55+"];
  const byAgeGroup = AGE_GROUPS.map((g) => {
    const [lo, hi] =
      g === "<15"
        ? [0, 14]
        : g === "55+"
          ? [55, 999]
          : g.split("-").map(Number);
    const inGroup = rows.filter((r) => r.age >= lo && r.age <= hi);
    return {
      group: g,
      male: inGroup.filter((r) => r.sex === "ชาย").length,
      female: inGroup.filter((r) => r.sex === "หญิง").length,
    };
  });

  const dayMap: Record<string, number> = {};
  rows.forEach((r) => {
    const d = r.treatDate.slice(0, 10);
    if (d) dayMap[d] = (dayMap[d] || 0) + 1;
  });
  const byDay = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    total,
    dead,
    admit,
    refer,
    dc,
    followUp,
    avgAge,
    minAge,
    maxAge,
    male,
    female,
    drinkCount,
    motorcycleCount,
    helmetWorn,
    helmetNot,
    byVehicle,
    bySeverity,
    byTambon,
    byTimeSlot,
    byStatus,
    byProtection,
    byAgeGroup,
    byDay,
    byRoad,
  };
}

export async function GET() {
  try {
    const sheets = await getSheetClient();

    // ดึง Sheet แรก (หรือ Sheet ชื่ออุบัติเหตุ)
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const firstSheet = meta.data.sheets?.[0]?.properties?.title ?? "Sheet1";

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${firstSheet}!A:Z`,
    });

    const raw = (res.data.values ?? []) as string[][];
    const { rows, sheetName } = parseRows(raw);
    const summary = buildSummary(rows);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sheetName: firstSheet,
      rows,
      summary,
    });
  } catch (err) {
    console.error("AccidentSheets error:", err);
    return NextResponse.json(
      {
        error:
          "ดึงข้อมูลจาก Google Sheets ไม่สำเร็จ: " + (err as Error).message,
      },
      { status: 500 },
    );
  }
}
