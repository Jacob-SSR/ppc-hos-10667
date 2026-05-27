// app/api/tb-dashboard/route.ts
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface TBRow {
  year: string;
  hn: string;
  sitthi: string;
  name: string;
  age: number | null;
  tambon: string;
  ud: string;
  regimen: string;
  regType: string;
  cxr: string;
  afb: string;
  culture: string;
  geneExpert: string;
  hiv: string;
  lft: string;
  bunCr: string;
  startDate: string; // "DD/MM/YYYY" Thai year
  outcome: string;
  concludeDate: string;
  note: string;
}

export interface TBByYear {
  year: string;
  total: number;
  cured: number;
  completed: number;
  onTreatment: number;
  died: number;
  ltfu: number;
  transferred: number;
  failed: number;
  other: number;
  successRate: number;
  mortalityRate: number;
  avgAge: number;
  byRegType: Record<string, number>;
  byTambon: Record<string, number>;
  byAFB: Record<string, number>;
  byHIV: Record<string, number>;
  byCXR: Record<string, number>;
  byGeneXpert: Record<string, number>;
  byUD: Record<string, number>;
  byRegimen: Record<string, number>;
  byMonth: { month: string; count: number }[];
  byCohort: Record<string, Record<string, number>>;
}

export interface TBSummary {
  total: number;
  byYear: TBByYear[];
  yearlyTrend: {
    year: string;
    total: number;
    cured: number;
    died: number;
    successRate: number;
  }[];
  allTambon: Record<string, number>;
  allOutcome: Record<string, number>;
}

export interface TBDashboardData {
  updatedAt: string;
  summary: TBSummary;
  rows: TBRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return "";
  return String(v).trim();
}
function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function normOutcome(raw: string): string {
  const r = raw.trim().toLowerCase();
  if (r === "cured") return "Cured";
  if (r === "completed") return "Completed";
  if (r.includes("on treatment")) return "On treatment";
  if (r.includes("dead") || r.includes("died")) return "Died";
  if (r.includes("lost")) return "LTFU";
  if (r.includes("transfer")) return "Transferred out";
  if (r.includes("mdr") || r.includes("failure") || r.includes("rr"))
    return "Failed";
  if (!raw.trim()) return "ไม่ระบุ";
  return raw.trim();
}

function normAFB(v: string): string {
  const r = v.trim().toLowerCase();
  if (!r || r === "/") return "ไม่ระบุ";
  if (r.includes("neg") || r === "-") return "Negative";
  if (r === "1+") return "1+";
  if (r === "2+") return "2+";
  if (r === "3+") return "3+";
  return "อื่นๆ";
}

function normHIV(v: string): string {
  const r = v.trim().toLowerCase();
  if (!r || r === "-" || r === "/") return "ไม่ระบุ";
  if (r.includes("pos")) return "Positive";
  if (r.includes("neg")) return "Negative";
  return "อื่นๆ";
}

function normCXR(v: string): string {
  const r = v.trim().toLowerCase();
  if (!r) return "ไม่ระบุ";
  if (r.includes("abnorm")) return "Abnormal";
  if (r.includes("normal")) return "Normal";
  return "อื่นๆ";
}

function normGX(v: string): string {
  const r = v.trim().toLowerCase();
  if (!r || r === "-" || r === "/") return "ไม่ระบุ";
  if (r.includes("detect")) return "MTB Detected";
  if (r.includes("not")) return "Not Detected";
  return "อื่นๆ";
}

function normTambon(v: string): string {
  if (!v || v === "-") return "ไม่ระบุ";
  const r = v.trim();
  if (r.includes("สำเดา") || r.includes("สำะเดา")) return "สะเดา";
  if (r === "ป่่าชัน") return "ป่าชัน";
  if (r.includes("โคกขมิ้")) return "โคกขมิ้น";
  return r;
}

function normUD(v: string): string[] {
  if (!v || v.trim() === "-" || v.trim() === "") return [];
  const text = v.toUpperCase();
  const tags: string[] = [];
  if (/\bDM\b/.test(text)) tags.push("DM");
  if (/\bHT\b/.test(text)) tags.push("HT");
  if (/\bCKD\b|\bESRD\b/.test(text)) tags.push("CKD");
  if (/\bDLP\b/.test(text)) tags.push("DLP");
  if (/\bCOPD\b/.test(text)) tags.push("COPD");
  if (/\bB24\b|\bHIV\b/.test(text)) tags.push("HIV/B24");
  if (/\bSTROKE\b|\bTIA\b/.test(text)) tags.push("Stroke");
  if (/HEPATITIS/.test(text)) tags.push("Hepatitis");
  if (/OLD TB/.test(text)) tags.push("Old TB");
  if (/\bGOUT\b/.test(text)) tags.push("Gout");
  if (/\bAF\b/.test(text)) tags.push("AF");
  if (/ALCOHOL|AWS/.test(text)) tags.push("Alcohol");
  return tags.length > 0 ? tags : ["อื่นๆ"];
}

function parseThaiDateStr(v: unknown): string {
  if (!v) return "";
  const s = String(v).trim();
  // Format DD/MM/YYYY (Thai year)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return s;
  const d = m[1].padStart(2, "0");
  const mo = m[2].padStart(2, "0");
  let y = parseInt(m[3]);
  if (y > 2400) y -= 543; // convert Thai → CE for sorting
  if (y < 1900 || y > 2100) return s;
  return `${y}-${mo}-${d}`;
}

function monthLabelFromDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return "";
  const y = parseInt(dateStr.slice(0, 4));
  const m = parseInt(dateStr.slice(5, 7));
  const MONTHS = [
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
  ];
  const thY = String(y + 543).slice(2);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${thY}` : `${m}/${thY}`;
}

// ─── Parse Excel ──────────────────────────────────────────────────────────────
function parseXlsx(filePath: string): TBRow[] {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  // Find the patient sheet (ผู้ป่วย or first sheet with HN column)
  let wsName = wb.SheetNames.find(
    (n) => n.includes("ผู้ป่วย") || n.toLowerCase().includes("patient"),
  );
  if (!wsName) wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  }) as unknown[][];
  if (raw.length < 2) return [];

  // Map column headers
  const header = (raw[0] as unknown[]).map((h) => toStr(h));
  const col = (kws: string[]) => {
    for (const kw of kws) {
      const i = header.findIndex((h) =>
        h.toLowerCase().includes(kw.toLowerCase()),
      );
      if (i >= 0) return i;
    }
    return -1;
  };

  const cYear = col(["ปีงบ"]);
  const cHN = col(["hn", "HN"]);
  const cSitthi = col(["สิทธิ"]);
  const cName = col(["ชื่อ-สกุล", "ชื่อ"]);
  const cAge = col(["อายุ"]);
  const cTambon = col(["ตำบล"]);
  const cUD = col(["โรคประจำตัว", "u/d"]);
  const cRegimen = col(["สูตรยา", "สูตร"]);
  const cRegType = col(["ประเภทขึ้นทะเบียน", "ประเภทการขึ้น"]);
  const cCXR = col(["cxr"]);
  const cAFB = col(["afb"]);
  const cCulture = col(["culture", "sputum"]);
  const cGX = col(["gene"]);
  const cHIV = col(["hiv"]);
  const cLFT = col(["lft"]);
  const cBunCr = col(["bun"]);
  const cStart = col(["วันที่เริ่มรักษา", "วันเริ่ม"]);
  const cOutcome = col(["ผลการรักษา", "outcome"]);
  const cConclude = col(["วันที่สรุป", "วันสรุป"]);
  const cNote = col(["หมายเหตุ", "note"]);

  const rows: TBRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    const hn = toStr(cHN >= 0 ? r[cHN] : null);
    const name = toStr(cName >= 0 ? r[cName] : null);
    if (!hn && !name) continue;

    const startRaw = cStart >= 0 ? toStr(r[cStart]) : "";
    const concludeRaw = cConclude >= 0 ? toStr(r[cConclude]) : "";
    const outcomeRaw = toStr(cOutcome >= 0 ? r[cOutcome] : null);

    rows.push({
      year: toStr(cYear >= 0 ? r[cYear] : null) || "2568",
      hn,
      sitthi: toStr(cSitthi >= 0 ? r[cSitthi] : null),
      name,
      age: cAge >= 0 ? toNum(r[cAge]) : null,
      tambon: normTambon(toStr(cTambon >= 0 ? r[cTambon] : null)),
      ud: toStr(cUD >= 0 ? r[cUD] : null),
      regimen: toStr(cRegimen >= 0 ? r[cRegimen] : null),
      regType: toStr(cRegType >= 0 ? r[cRegType] : null),
      cxr: normCXR(toStr(cCXR >= 0 ? r[cCXR] : null)),
      afb: normAFB(toStr(cAFB >= 0 ? r[cAFB] : null)),
      culture: toStr(cCulture >= 0 ? r[cCulture] : null),
      geneExpert: normGX(toStr(cGX >= 0 ? r[cGX] : null)),
      hiv: normHIV(toStr(cHIV >= 0 ? r[cHIV] : null)),
      lft: toStr(cLFT >= 0 ? r[cLFT] : null),
      bunCr: toStr(cBunCr >= 0 ? r[cBunCr] : null),
      startDate: parseThaiDateStr(startRaw),
      outcome: normOutcome(outcomeRaw),
      concludeDate: parseThaiDateStr(concludeRaw),
      note: toStr(cNote >= 0 ? r[cNote] : null),
    });
  }
  return rows;
}

// ─── Aggregate ───────────────────────────────────────────────────────────────
function countBy<K extends keyof TBRow>(
  rows: TBRow[],
  key: K,
): Record<string, number> {
  const m: Record<string, number> = {};
  rows.forEach((r) => {
    const v = String(r[key] ?? "ไม่ระบุ").trim() || "ไม่ระบุ";
    m[v] = (m[v] || 0) + 1;
  });
  return m;
}

function buildYearSummary(year: string, rows: TBRow[]): TBByYear {
  const total = rows.length;
  const c = (o: string) => rows.filter((r) => r.outcome === o).length;
  const cured = c("Cured");
  const completed = c("Completed");
  const onTx = c("On treatment");
  const died = c("Died");
  const ltfu = c("LTFU");
  const transferred = c("Transferred out");
  const failed = c("Failed");
  const other =
    total - cured - completed - onTx - died - ltfu - transferred - failed;

  const successRate =
    total > 0 ? Math.round(((cured + completed) / total) * 1000) / 10 : 0;
  const mortalityRate = total > 0 ? Math.round((died / total) * 1000) / 10 : 0;

  const ages = rows
    .map((r) => r.age)
    .filter((a): a is number => a != null && a > 0 && a < 120);
  const avgAge =
    ages.length > 0
      ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
      : 0;

  // Monthly trend
  const monthMap: Record<string, number> = {};
  rows.forEach((r) => {
    const lbl = monthLabelFromDate(r.startDate);
    if (lbl) monthMap[lbl] = (monthMap[lbl] || 0) + 1;
  });
  const byMonth = Object.entries(monthMap).map(([month, count]) => ({
    month,
    count,
  }));

  // Cohort: group by start month × outcome
  const cohortMap: Record<string, Record<string, number>> = {};
  rows.forEach((r) => {
    const lbl = monthLabelFromDate(r.startDate);
    if (!lbl) return;
    if (!cohortMap[lbl]) cohortMap[lbl] = {};
    const o = r.outcome || "ไม่ระบุ";
    cohortMap[lbl][o] = (cohortMap[lbl][o] || 0) + 1;
  });

  // U/D aggregation (multi-tag)
  const byUD: Record<string, number> = {};
  rows.forEach((r) => {
    normUD(r.ud).forEach((tag) => {
      byUD[tag] = (byUD[tag] || 0) + 1;
    });
  });

  // Regimen: normalize
  const regimenMap: Record<string, number> = {};
  rows.forEach((r) => {
    if (!r.regimen) return;
    const key = r.regimen.split(/\s/)[0].slice(0, 20).trim();
    if (key) regimenMap[key] = (regimenMap[key] || 0) + 1;
  });

  return {
    year,
    total,
    cured,
    completed,
    onTreatment: onTx,
    died,
    ltfu,
    transferred,
    failed,
    other: Math.max(0, other),
    successRate,
    mortalityRate,
    avgAge,
    byRegType: countBy(rows, "regType"),
    byTambon: countBy(rows, "tambon"),
    byAFB: countBy(rows, "afb"),
    byHIV: countBy(rows, "hiv"),
    byCXR: countBy(rows, "cxr"),
    byGeneXpert: countBy(rows, "geneExpert"),
    byUD,
    byRegimen: regimenMap,
    byMonth,
    byCohort: cohortMap,
  };
}

function buildSummary(rows: TBRow[]): TBSummary {
  const years = [...new Set(rows.map((r) => r.year))].sort();
  const byYear = years.map((y) =>
    buildYearSummary(
      y,
      rows.filter((r) => r.year === y),
    ),
  );
  const yearlyTrend = byYear.map((y) => ({
    year: y.year,
    total: y.total,
    cured: y.cured,
    died: y.died,
    successRate: y.successRate,
  }));

  const allTambon: Record<string, number> = {};
  const allOutcome: Record<string, number> = {};
  rows.forEach((r) => {
    allTambon[r.tambon] = (allTambon[r.tambon] || 0) + 1;
    allOutcome[r.outcome] = (allOutcome[r.outcome] || 0) + 1;
  });

  return { total: rows.length, byYear, yearlyTrend, allTambon, allOutcome };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "tb-patients.xlsx");
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "ไม่พบไฟล์ data/tb-patients.xlsx — กรุณาอัปโหลดข้อมูลก่อน" },
        { status: 404 },
      );
    }
    const rows = parseXlsx(filePath);
    const summary = buildSummary(rows);
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      summary,
      rows,
    } satisfies TBDashboardData);
  } catch (err) {
    console.error("TBDashboard error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
