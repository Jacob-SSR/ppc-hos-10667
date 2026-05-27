// app/api/drug-dashboard/route.ts
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";

export interface DrugPatientRow {
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

export interface DrugDashboardData {
  updatedAt: string;
  summary: DrugDashboardSummary;
  rows: DrugPatientRow[];
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function normalizeColor(raw: string): string {
  if (!raw) return "ไม่ระบุ";
  const r = raw.trim();
  if (r.includes("เขี") || r.includes("เขึ")) return "เขียว";
  if (r.includes("ส้ม")) return "ส้ม";
  if (r.includes("เหลือง")) return "เหลือง";
  if (r.includes("แดง")) return "แดง";
  return r;
}

function parseDateStr(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) {
    let y = v.getFullYear();
    if (y > 2400) y -= 543;
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // Thai date string dd/mm/yyyy
  const thai = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (thai) {
    let y = parseInt(thai[3]);
    if (y > 2400) y -= 543;
    return `${y}-${thai[2].padStart(2, "0")}-${thai[1].padStart(2, "0")}`;
  }
  return s.slice(0, 10);
}

function getMonth(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return "";
  return dateStr.slice(0, 7);
}

const THAI_MONTHS: Record<string, string> = {
  "01": "ม.ค.",
  "02": "ก.พ.",
  "03": "มี.ค.",
  "04": "เม.ย.",
  "05": "พ.ค.",
  "06": "มิ.ย.",
  "07": "ก.ค.",
  "08": "ส.ค.",
  "09": "ก.ย.",
  "10": "ต.ค.",
  "11": "พ.ย.",
  "12": "ธ.ค.",
};

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const thaiY = String(parseInt(y) + 543).slice(2);
  return `${THAI_MONTHS[m] ?? m} ${thaiY}`;
}

function parseXlsx(filePath: string): DrugPatientRow[] {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  }) as unknown[][];

  const rows: DrugPatientRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    if (r[0] == null) continue;
    rows.push({
      no: toNum(r[0]),
      treatStatus: toStr(r[2]),
      detailStatus: toStr(r[3]),
      program: toStr(r[4]),
      referralMethod: toStr(r[5]),
      tambon: toStr(r[6]),
      hn: toStr(r[7]),
      prefix: toStr(r[12]),
      firstName: toStr(r[13]),
      lastName: toStr(r[14]),
      age: toNum(r[16]),
      v2Score: toNum(r[17]),
      colorSeverity: normalizeColor(toStr(r[18])),
      isNew: !!r[19],
      startDate: parseDateStr(r[35] || r[36]),
    });
  }
  return rows;
}

function buildSummary(rows: DrugPatientRow[]): DrugDashboardSummary {
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

  const count = (key: keyof DrugPatientRow) => {
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

  // Monthly trend
  const monthMap: Record<string, number> = {};
  rows.forEach((r) => {
    const m = getMonth(r.startDate);
    if (m) monthMap[m] = (monthMap[m] || 0) + 1;
  });
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month: monthLabel(month), count }));

  // Normalize referral
  const rawReferral = count("referralMethod");
  const byReferral: Record<string, number> = {};
  Object.entries(rawReferral).forEach(([k, v]) => {
    const clean = k.replace(/์{2,}/g, "์").trim();
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
    byTreatStatus: count("treatStatus"),
    byDetailStatus: count("detailStatus"),
    byProgram: count("program"),
    byTambon: count("tambon"),
    byReferral,
    byColor: count("colorSeverity"),
    byAgeGroup,
    byV2Group,
    byMonth,
  };
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "drug-patients.xlsx");
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "ไม่พบไฟล์ data/drug-patients.xlsx — กรุณาอัปโหลดข้อมูลก่อน" },
        { status: 404 },
      );
    }
    const rows = parseXlsx(filePath);
    const summary = buildSummary(rows);
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      summary,
      rows,
    } satisfies DrugDashboardData);
  } catch (err) {
    console.error("DrugDashboard error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
