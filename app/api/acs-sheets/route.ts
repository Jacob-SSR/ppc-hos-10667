// app/api/acs-sheets/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  toNumOrNull,
  countBy,
  sheetsError,
} from "@/lib/sheets";
import { cachedQuery } from "@/lib/cache";

const SPREADSHEET_ID = process.env.ACS_SPREADSHEET_ID!;
const TTL_RESULT = 300; // 5 นาที — ข้อมูลคีย์มือ

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AcsPatient {
  no: string;
  name: string;
  age: number | null;
  hn: string;
  underlying: string;
  smoking: string;
  alcohol: string;
  serviceDate: string;
  serviceTime: string;
  firstUnit: string;
  ems1669: string;
  onsetTime: string;
  ps: string;
  ekgMin: number | null;
  diagnosis: string;
  otherDiagnosis: string;
  tropT: string;
  skGiven: string;
  skTime: string;
  otherTreatment: string;
  status: string;
  referDate: string;
  referTime: string;
  referUnit: string;
  area: string;
  definiteDiagnosis: string;
  outcome: string;
  note: string;
}

export interface AcsSummary {
  total: number;
  stemi: number;
  nstemi: number;
  otherDx: number;
  skGiven: number;
  ekgWithin10: number;
  ekgRecorded: number;
  refer: number;
  smoking: number;
  ems1669: number;
  avgAge: number | null;
  byDiagnosis: Record<string, number>;
  byFirstUnit: Record<string, number>;
  byArea: Record<string, number>;
  byOutcome: Record<string, number>;
}

export interface AcsSheetsData {
  year: string;
  availableYears: string[];
  /** grid ดิบจากชีต "KPI" — แสดงตามที่หน้างานคีย์ ไม่แปลงค่า */
  kpiRows: string[][];
  rows: AcsPatient[];
  summary: AcsSummary;
  updatedAt: string;
}

// ─── Parse ────────────────────────────────────────────────────────────────────
function parsePatient(r: string[]): AcsPatient {
  return {
    no: toStr(r[0]),
    name: toStr(r[1]),
    age: toNumOrNull(r[2]),
    hn: toStr(r[3]),
    underlying: toStr(r[4]),
    smoking: toStr(r[5]),
    alcohol: toStr(r[6]),
    serviceDate: toStr(r[7]),
    serviceTime: toStr(r[8]),
    firstUnit: toStr(r[9]),
    ems1669: toStr(r[10]),
    onsetTime: toStr(r[11]),
    ps: toStr(r[12]),
    ekgMin: toNumOrNull(r[13]),
    diagnosis: toStr(r[14]),
    otherDiagnosis: toStr(r[15]),
    tropT: toStr(r[16]),
    skGiven: toStr(r[17]),
    skTime: toStr(r[18]),
    otherTreatment: toStr(r[19]),
    status: toStr(r[20]),
    referDate: toStr(r[21]),
    referTime: toStr(r[22]),
    referUnit: toStr(r[23]),
    area: toStr(r[24]),
    definiteDiagnosis: toStr(r[25]),
    outcome: toStr(r[26]),
    note: toStr(r[27]),
  };
}

function buildSummary(rows: AcsPatient[]): AcsSummary {
  const dx = (p: AcsPatient) => p.diagnosis.toUpperCase();
  const stemi = rows.filter(
    (p) => dx(p).includes("STEMI") && !dx(p).includes("NSTEMI"),
  ).length;
  const nstemi = rows.filter((p) => dx(p).includes("NSTEMI")).length;

  const withEkg = rows.filter((p) => p.ekgMin != null);
  const ages = rows.map((p) => p.age).filter((a): a is number => a != null);

  return {
    total: rows.length,
    stemi,
    nstemi,
    otherDx: rows.length - stemi - nstemi,
    skGiven: rows.filter((p) => /^y/i.test(p.skGiven)).length,
    ekgWithin10: withEkg.filter((p) => (p.ekgMin as number) <= 10).length,
    ekgRecorded: withEkg.length,
    refer: rows.filter((p) => /refer/i.test(p.status)).length,
    smoking: rows.filter((p) => p.smoking === "สูบ").length,
    ems1669: rows.filter((p) => /^y/i.test(p.ems1669)).length,
    avgAge: ages.length
      ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10
      : null,
    byDiagnosis: countBy(rows, "diagnosis"),
    byFirstUnit: countBy(rows, "firstUnit"),
    byArea: countBy(rows, "area"),
    byOutcome: countBy(rows, "outcome"),
  };
}

// ─── Payload ──────────────────────────────────────────────────────────────────
async function buildPayload(yearParam: string): Promise<AcsSheetsData> {
  const sheets = await getSheetClient();

  const titles = await getAllSheetTitles(sheets, SPREADSHEET_ID);
  const availableYears = titles
    .filter((t) => /^\d{4}$/.test(t))
    .sort((a, b) => Number(b) - Number(a));
  if (availableYears.length === 0) {
    throw new Error("ไม่พบชีตปี (พ.ศ. 4 หลัก) ใน spreadsheet");
  }

  const year = availableYears.includes(yearParam)
    ? yearParam
    : availableYears[0];

  const [kpiRaw, patientRaw] = await Promise.all([
    getValues(sheets, SPREADSHEET_ID, "KPI!A1:L60"),
    getValues(sheets, SPREADSHEET_ID, `'${year}'!A4:AB200`),
  ]);

  // KPI: ตัดแถวว่างท้ายตาราง คงแถวว่างกลางไว้เป็นตัวคั่นบล็อก + pad ให้ครบ 12 คอลัมน์
  let lastNonEmpty = -1;
  kpiRaw.forEach((row, i) => {
    if (row.some((c) => toStr(c) !== "")) lastNonEmpty = i;
  });
  const kpiRows = kpiRaw
    .slice(0, lastNonEmpty + 1)
    .map((row) =>
      Array.from({ length: 12 }, (_, i) => toStr(row[i]).replace(/\.0$/, "")),
    );

  const rows = patientRaw.filter((r) => toStr(r[1]) !== "").map(parsePatient);

  return {
    year,
    availableYears,
    kpiRows,
    rows,
    summary: buildSummary(rows),
    updatedAt: new Date().toISOString(),
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const year = req.nextUrl.searchParams.get("year") ?? "";
    const payload = await cachedQuery(
      ["acs-sheets", year || "latest"],
      () => buildPayload(year),
      TTL_RESULT,
    );
    return NextResponse.json(payload);
  } catch (err) {
    return sheetsError(err, "AcsSheets");
  }
}
