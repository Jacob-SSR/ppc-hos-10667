// app/api/acs-sheets/route.ts
// Dashboard โรคหลอดเลือดหัวใจ (ACS) — อ่านจาก Google Sheets ทะเบียนผู้ป่วย ACS
// โครงสร้างชีต: "KPI" (ตัวชี้วัด×รายปี คีย์มือ) + ชีตรายปี พ.ศ. "2561".."2569" (header แถว 3)
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

// ── KPI จากชีต (คีย์มือ) — แบบเดียวกับ DrugKpiItem แต่เป็นรายปี ──────────────
export interface AcsKpiYearValue {
  year: string; // พ.ศ. เช่น "2569"
  raw: string; // ค่าตามที่คีย์ เช่น "12.5<2>", "1/3=33", "NA"
  percent: number | null; // ร้อยละที่ parse ได้ (null ถ้า parse ไม่ได้/NA)
}

export interface AcsKpiItem {
  name: string;
  target: string; // เช่น "<ร้อยละ 8", ">=ร้อยละ 70" ("" ถ้าไม่มี)
  values: AcsKpiYearValue[];
}

export interface AcsKpiBlock {
  title: string; // หัวข้อกลุ่ม ("" = กลุ่มตัวชี้วัดหลัก)
  nByYear: Record<string, string>; // เช่น { "2569": "N = 4" }
  items: AcsKpiItem[];
  notes: string[]; // หมายเหตุท้ายบล็อก
}

export interface AcsSheetsData {
  year: string;
  availableYears: string[];
  kpiBlocks: AcsKpiBlock[];
  rows: AcsPatient[];
  summary: AcsSummary;
  updatedAt: string;
}

// ─── KPI parser ───────────────────────────────────────────────────────────────
/**
 * แปลงค่าที่หน้างานคีย์ → ร้อยละ (รับได้หลายรูปแบบ):
 *   "12.5<2>" / "30(3)" → 12.5 / 30
 *   "1/3=33" / "3/6 = 50" → 33 / 50
 *   "1/250" → คำนวณ 0.4
 *   "100" → 100 · "NA"/ว่าง/อ่านไม่ออก (เช่น "1oo") → null
 */
function parseKpiPercent(raw: string): number | null {
  const v = raw.trim();
  if (!v || /^na$/i.test(v)) return null;
  let m = v.match(/^(\d+(?:\.\d+)?)\s*[<(]/);
  if (m) return Number(m[1]);
  m = v.match(/=\s*(\d+(?:\.\d+)?)/);
  if (m) return Number(m[1]);
  m = v.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (m && Number(m[2]) > 0)
    return Math.round((Number(m[1]) / Number(m[2])) * 1000) / 10;
  if (/^\d+(?:\.\d+)?$/.test(v)) return Number(v);
  return null;
}

function parseKpiBlocks(grid: string[][]): AcsKpiBlock[] {
  const blocks: AcsKpiBlock[] = [];
  let cur: AcsKpiBlock | null = null;
  let yearCols: { col: number; year: string }[] = [];
  let hasTargetCol = false;

  for (const row of grid) {
    // แถว header = มีเลขปี พ.ศ. → เริ่มบล็อกใหม่
    if (row.some((c) => /^25\d{2}$/.test(c))) {
      yearCols = row
        .map((c, col) => ({ c, col }))
        .filter(({ c }) => /^25\d{2}$/.test(c))
        .map(({ c, col }) => ({ col, year: c }));
      hasTargetCol = row.includes("เป้าหมาย");
      cur = { title: "", nByYear: {}, items: [], notes: [] };
      blocks.push(cur);
      continue;
    }
    if (!cur || yearCols.length === 0) continue;

    const name = row[0];
    const vals = yearCols.map(({ col, year }) => ({
      year,
      raw: row[col] ?? "",
    }));
    const hasAnyVal = vals.some((v) => v.raw !== "");

    // แถว N = จำนวนผู้ป่วยต่อปี (ถ้ามีชื่อด้วย = หัวข้อกลุ่ม)
    if (vals.some((v) => /^N\s*=/i.test(v.raw))) {
      if (name && !cur.title) cur.title = name;
      vals.forEach((v) => {
        if (v.raw) cur!.nByYear[v.year] = v.raw;
      });
      continue;
    }
    if (!name) continue;

    const target = hasTargetCol ? (row[1] ?? "").trim() : "";
    // บล็อกที่มีคอลัมน์เป้าหมาย: แถวที่ไม่มีทั้งเป้าหมายและค่า = หมายเหตุ
    if (hasTargetCol && !target && !hasAnyVal) {
      cur.notes.push(name);
      continue;
    }
    cur.items.push({
      name,
      target,
      values: vals.map((v) => ({ ...v, percent: parseKpiPercent(v.raw) })),
    });
  }
  return blocks.filter((b) => b.items.length > 0 || b.notes.length > 0);
}

// ─── Patient parse ────────────────────────────────────────────────────────────
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

  const kpiGrid = kpiRaw.map((row) =>
    Array.from({ length: 12 }, (_, i) => toStr(row[i]).replace(/\.0$/, "")),
  );

  const rows = patientRaw.filter((r) => toStr(r[1]) !== "").map(parsePatient);

  return {
    year,
    availableYears,
    kpiBlocks: parseKpiBlocks(kpiGrid),
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
