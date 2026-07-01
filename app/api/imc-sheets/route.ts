import { NextResponse } from "next/server";
import {
  getSheetClient,
  getFirstSheetTitle,
  getValues,
  toStr,
  toNumOrNull,
  countBy,
  parseDate,
  sheetsError,
} from "@/lib/sheets";

const SPREADSHEET_ID = process.env.IMC_SPREADSHEET_ID!;

// ─── Column map (ตรงกับ header จริงในชีต) ────────────────────────────────────
const COLUMN_MAP: Record<string, keyof ImcRow> = {
  ลำดับ: "no",
  ปีงบ: "fiscalYear",
  "Referback/walkin": "channel",
  HN: "hn",
  AN: "an",
  "ชื่อ-สกุล": "name",
  อายุ: "age",
  ตำบล: "tambon",
  อำเภอ: "amphoe",
  "Dx.": "diagnosis",
  "complication at ward": "complication",
  หน่วยลงทะเบียน: "registerUnit",
  "Admit วันที่": "admitDate",
  "D/C วันที่": "dcDate",
  ครบฟื้นฟู: "rehabComplete",
  "BI แรกรับ": "biAdmit",
  "BI ก่อนกลับบ้าน": "biBeforeDc",
  หมายเหตุ: "note",
  "Financial claim": "claim",
  "BIหลัง d/c": "biAfterDc",
};

export interface ImcRow {
  no: number;
  fiscalYear: string;
  channel: string;
  hn: string;
  an: string;
  name: string;
  age: number | null;
  tambon: string;
  amphoe: string;
  diagnosis: string;
  complication: string;
  registerUnit: string;
  admitDate: string;
  dcDate: string;
  rehabComplete: string;
  biAdmit: number | null;
  biBeforeDc: number | null;
  biAfterDc: number | null;
  note: string;
  claim: number;
  finalStatus: string;
  followUpCount: number;
}

export interface BiDx {
  admit: number;
  dc: number;
  n: number;
}

export interface FiscalBreakdown {
  total: number;
  dx: Record<string, number>;
  channel: Record<string, number>;
  status: Record<string, number>;
  comp: Record<string, number>;
  biDx: Record<string, BiDx>;
  monthly: { key: string; label: string; count: number }[];
  biAdmitAvg: number;
  biDcAvg: number;
  improvementRate: number;
  compFreeRate: number;
  totalClaim: number;
}

function normStatus(raw: string): string {
  const s = raw.trim();
  if (!s) return "ไม่ระบุ";
  if (s.toLowerCase().startsWith("improve"))
    return s.includes("จำหน่าย") ? "Improvement, จำหน่าย" : "Improvement";
  if (s === "Home") return "Home";
  if (s === "LTC") return "LTC";
  if (s === "Death") return "Death";
  if (s.includes("ย้าย")) return "ย้าย";
  return s;
}

const THAI_M = [
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
function monthLabelBE(key: string): string {
  const [y, m] = key.split("-");
  const idx = parseInt(m, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return key;
  return `${THAI_M[idx]} ${String(parseInt(y) + 543).slice(2)}`;
}

function parseRows(rawRows: string[][]): { rows: ImcRow[]; headers: string[] } {
  if (rawRows.length < 2) return { rows: [], headers: [] };

  const header = rawRows[0].map((h) => toStr(h));
  const colIndex: Partial<Record<keyof ImcRow, number>> = {};
  let statusIdx = -1;
  header.forEach((h, i) => {
    if (h.includes("status") && h.includes("d/c")) {
      statusIdx = i;
      return;
    }
    const key = COLUMN_MAP[h];
    if (key) colIndex[key] = i;
  });

  const fuStart = header.findIndex((h) => h.includes("f/U1"));
  const fuEnd = header.findIndex((h) => h.trim() === "f/U20");

  const get = (row: string[], key: keyof ImcRow): string => {
    const idx = colIndex[key];
    return idx !== undefined ? toStr(row[idx]) : "";
  };

  const rows: ImcRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every((c) => !c || !String(c).trim())) continue;

    const name = get(row, "name");
    const dx = get(row, "diagnosis");
    if (!name && !dx) continue;

    let fuCount = 0;
    if (fuStart >= 0 && fuEnd >= fuStart) {
      for (let j = fuStart; j <= fuEnd; j++) {
        if (row[j] && String(row[j]).trim()) fuCount++;
      }
    }

    rows.push({
      no: toNumOrNull(get(row, "no")) ?? i,
      fiscalYear: get(row, "fiscalYear").replace(/\.0$/, ""),
      channel: get(row, "channel") || "ไม่ระบุ",
      hn: get(row, "hn"),
      an: get(row, "an").replace(/\.0$/, ""),
      name,
      age: toNumOrNull(get(row, "age")),
      tambon: get(row, "tambon") || "ไม่ระบุ",
      amphoe: get(row, "amphoe"),
      diagnosis: dx.trim() || "ไม่ระบุ",
      complication: get(row, "complication") || "No",
      registerUnit: get(row, "registerUnit"),
      admitDate: parseDate(get(row, "admitDate"), { validate: true }),
      dcDate: parseDate(get(row, "dcDate"), { validate: true }),
      rehabComplete: get(row, "rehabComplete"),
      biAdmit: toNumOrNull(get(row, "biAdmit")),
      biBeforeDc: toNumOrNull(get(row, "biBeforeDc")),
      biAfterDc: toNumOrNull(get(row, "biAfterDc")),
      note: get(row, "note"),
      claim: toNumOrNull(get(row, "claim")) ?? 0,
      finalStatus:
        statusIdx >= 0 ? normStatus(toStr(row[statusIdx])) : "ไม่ระบุ",
      followUpCount: fuCount,
    });
  }

  return { rows, headers: header };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function breakdown(rows: ImcRow[]): FiscalBreakdown {
  const total = rows.length;

  const biDxMap: Record<string, { admit: number; dc: number; n: number }> = {};
  rows.forEach((r) => {
    if (r.biAdmit == null || r.biBeforeDc == null) return;
    if (!biDxMap[r.diagnosis]) biDxMap[r.diagnosis] = { admit: 0, dc: 0, n: 0 };
    const e = biDxMap[r.diagnosis];
    e.admit += r.biAdmit;
    e.dc += r.biBeforeDc;
    e.n++;
  });
  const biDx: Record<string, BiDx> = {};
  Object.entries(biDxMap).forEach(([k, v]) => {
    biDx[k] = { admit: round1(v.admit / v.n), dc: round1(v.dc / v.n), n: v.n };
  });

  const biAdmitVals = rows
    .map((r) => r.biAdmit)
    .filter((v): v is number => v != null);
  const biDcVals = rows
    .map((r) => r.biBeforeDc)
    .filter((v): v is number => v != null);
  const biAdmitAvg = biAdmitVals.length
    ? round1(biAdmitVals.reduce((s, v) => s + v, 0) / biAdmitVals.length)
    : 0;
  const biDcAvg = biDcVals.length
    ? round1(biDcVals.reduce((s, v) => s + v, 0) / biDcVals.length)
    : 0;

  const mMap: Record<string, number> = {};
  rows.forEach((r) => {
    if (/^\d{4}-\d{2}/.test(r.admitDate)) {
      const key = r.admitDate.slice(0, 7);
      mMap[key] = (mMap[key] || 0) + 1;
    }
  });
  const monthly = Object.entries(mMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ key, label: monthLabelBE(key), count }));

  const status = countBy(rows, "finalStatus");
  const improvedN =
    (status["Home"] || 0) +
    (status["Improvement"] || 0) +
    (status["Improvement, จำหน่าย"] || 0);
  const comp = countBy(rows, "complication");
  const compFree = comp["No"] || 0;

  return {
    total,
    dx: countBy(rows, "diagnosis"),
    channel: countBy(rows, "channel"),
    status,
    comp,
    biDx,
    monthly,
    biAdmitAvg,
    biDcAvg,
    improvementRate: total ? Math.round((improvedN / total) * 100) : 0,
    compFreeRate: total ? Math.round((compFree / total) * 100) : 0,
    totalClaim: rows.reduce((s, r) => s + r.claim, 0),
  };
}

export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const sheets = await getSheetClient();
    const firstSheet = await getFirstSheetTitle(sheets, SPREADSHEET_ID);
    const raw = await getValues(sheets, SPREADSHEET_ID, `${firstSheet}!A:AZ`);

    const { rows, headers } = parseRows(raw);

    const years = Array.from(
      new Set(rows.map((r) => r.fiscalYear).filter((y) => /^\d{4}$/.test(y))),
    ).sort();
    const byYear: Record<string, FiscalBreakdown> = {};
    years.forEach((y) => {
      byYear[y] = breakdown(rows.filter((r) => r.fiscalYear === y));
    });
    const all = breakdown(rows);

    if (debug) {
      return NextResponse.json({
        headers,
        totalRows: rows.length,
        years,
        sample: rows.slice(0, 3),
        all,
      });
    }

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sheetName: firstSheet,
      years,
      all,
      byYear,
      rows,
    });
  } catch (err) {
    return sheetsError(err, "ImcSheets");
  }
}
