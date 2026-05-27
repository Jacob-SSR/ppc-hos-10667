// app/api/sepsis-dashboard/route.ts
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SepsisRow {
  no: number;
  year: string; // "2569"
  name: string;
  hn: string;
  age: number | null;
  comorbidity: string;
  serviceDate: string; // "2568-11-02"
  dxDate: string;
  department: string; // ER / OPD / ICU
  diagnosis: string;
  septicShock: boolean | null;
  atb: string;
  atbDate: string;
  cultureType: string; // H/C
  pathogen: string;
  patientStatus: string; // Admit / Refer Back
  definiteDx: string;
  siteOfInfection: string; // RS / GU / Systemic / GI / MSK / CNS
  typeOfInfection: string; // Community / Nosocomial
  definiteStatus: string; // Improve / Dead
  zone: string; // พลับพลาชัย / ป่าชัน / ...
}

export interface SepsisByYear {
  year: string;
  total: number;
  admit: number;
  dead: number;
  improve: number;
  septicShock: number;
  mortalityRate: number;
  community: number;
  nosocomial: number;
  bySite: Record<string, number>;
  byDept: Record<string, number>;
  byPathogen: Record<string, number>;
  byZone: Record<string, number>;
  byComorbidity: Record<string, number>;
  byMonth: { month: string; count: number }[];
  avgAge: number;
  byAgeGroup: Record<string, number>;
}

export interface SepsisSummary {
  total: number;
  byYear: SepsisByYear[];
  yearlyTrend: {
    year: string;
    total: number;
    dead: number;
    mortalityRate: number;
  }[];
  allPathogen: Record<string, number>;
  allSite: Record<string, number>;
  allZone: Record<string, number>;
  allDept: Record<string, number>;
  allComorbidity: Record<string, number>;
}

export interface SepsisDashboardData {
  updatedAt: string;
  summary: SepsisSummary;
  rows: SepsisRow[];
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
  return isNaN(n) || !isFinite(n) ? null : n;
}

function toDateStr(v: unknown, yearOffset = 0): string {
  if (!v) return "";
  if (v instanceof Date) {
    let y = v.getFullYear();
    if (y > 2400) y -= 543;
    y += yearOffset;
    if (y < 1900 || y > 2100) return "";
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

const THAI_MONTHS: Record<string, string> = {
  "01": "ต.ค.",
  "02": "พ.ย.",
  "03": "ธ.ค.",
  "04": "ม.ค.",
  "05": "ก.พ.",
  "06": "มี.ค.",
  "07": "เม.ย.",
  "08": "พ.ค.",
  "09": "มิ.ย.",
  "10": "ก.ค.",
  "11": "ส.ค.",
  "12": "ก.ย.",
};

function monthLabel(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return "";
  const m = dateStr.slice(5, 7);
  const y = dateStr.slice(0, 4);
  return `${THAI_MONTHS[m] ?? m} ${String(parseInt(y) + 543).slice(2)}`;
}

function normPathogen(raw: string): string {
  if (!raw || raw === "-") return "ไม่ระบุ";
  const r = raw.trim();
  if (r.startsWith("NG") || r.startsWith("ng")) return "No Growth";
  if (r.toLowerCase().includes("contaminate")) return "Contaminate";
  if (
    r.toLowerCase().includes("e. coli") ||
    r.toLowerCase().includes("escherichia coli") ||
    r.toLowerCase().includes("e coli")
  )
    return "E. coli";
  if (r.toLowerCase().includes("klebsiella")) return "Klebsiella spp.";
  if (r.toLowerCase().includes("staphylococcus")) return "Staphylococcus spp.";
  if (r.toLowerCase().includes("pseudomonas")) return "Pseudomonas spp.";
  if (r.toLowerCase().includes("burkholderia")) return "Burkholderia spp.";
  if (r.toLowerCase().includes("acinetobacter")) return "Acinetobacter spp.";
  if (r.toLowerCase().includes("streptococcus")) return "Streptococcus spp.";
  if (r.toLowerCase().includes("gnb") || r.toLowerCase().includes("gram neg"))
    return "GNB";
  if (r.toLowerCase().includes("gram pos")) return "Gram Positive";
  return r.length > 30 ? r.slice(0, 28) + "…" : r;
}

function normZone(raw: string): string {
  if (!raw || raw === "-") return "ไม่ระบุ";
  const r = raw.trim();
  // normalize typos เช่น โคกขมิ้่น
  if (r.includes("โคก")) return "โคกขมิ้น";
  if (r.includes("นอก")) return "นอกเขต";
  return r;
}

function normSite(raw: string): string {
  const map: Record<string, string> = {
    RS: "ระบบทางเดินหายใจ (RS)",
    GU: "ระบบทางเดินปัสสาวะ (GU)",
    GI: "ระบบทางเดินอาหาร (GI)",
    Systemic: "ทั่วร่างกาย (Systemic)",
    CNS: "ระบบประสาท (CNS)",
    "MSK and Skin": "ผิวหนัง/กล้ามเนื้อ (MSK)",
    MSK: "ผิวหนัง/กล้ามเนื้อ (MSK)",
  };
  return map[raw?.trim()] ?? raw?.trim() ?? "ไม่ระบุ";
}

function normComorbidity(raw: string): string[] {
  if (!raw || raw.toLowerCase() === "unknown" || raw === "-")
    return ["ไม่ทราบ"];
  const items = raw.split(/[,\/;]/).map((s) => s.trim().toUpperCase());
  const result: string[] = [];
  items.forEach((it) => {
    if (!it) return;
    if (it.includes("DM")) result.push("DM");
    else if (it.includes("HT")) result.push("HT");
    else if (it.includes("CKD") || it.includes("ESRD")) result.push("CKD/ESRD");
    else if (it.includes("CA") || it.includes("CANCER")) result.push("Cancer");
    else if (it.includes("COPD")) result.push("COPD");
    else if (it.includes("CVA") || it.includes("STROKE")) result.push("CVA");
    else if (it.includes("CLD") || it.includes("CIRRHOSIS")) result.push("CLD");
    else if (it.includes("SLE")) result.push("SLE");
    else if (it.includes("AIDS") || it.includes("HIV")) result.push("HIV/AIDS");
    else if (it.length > 0 && it.length <= 15) result.push(it);
  });
  return result.length > 0 ? result : ["อื่นๆ"];
}

// ─── Column mapping per sheet type ───────────────────────────────────────────
// "new" = 2567,2568,2569  "old" = 2565,2566
function detectLayout(header: unknown[]): "new2569" | "new" | "old" {
  const h = header.map((v) => toStr(v));
  if (h[6] && h[6].includes("OPD")) return "new2569"; // 2569 has extra cols
  if (h[7] && h[7].includes("Dx")) return "new"; // 2567-2568
  return "old"; // 2565-2566
}

interface ColMap {
  name: number;
  hn: number;
  age: number | null;
  comorbidity: number;
  serviceDate: number;
  dxDate: number;
  dept: number;
  diagnosis: number;
  septicShock: number | null;
  atb: number;
  atbDate: number;
  culture: number;
  pathogen: number;
  patientStatus: number;
  definiteDx: number;
  site: number;
  typeInf: number;
  definiteStatus: number;
  zone: number;
}

function getColMap(layout: "new2569" | "new" | "old"): ColMap {
  if (layout === "new2569") {
    return {
      name: 1,
      hn: 2,
      age: 3,
      comorbidity: 4,
      serviceDate: 5,
      dxDate: 9,
      dept: 11,
      diagnosis: 12,
      septicShock: null,
      atb: 13,
      atbDate: 14,
      culture: 16,
      pathogen: 18,
      patientStatus: 20,
      definiteDx: 21,
      site: 22,
      typeInf: 23,
      definiteStatus: 24,
      zone: 25,
    };
  }
  if (layout === "new") {
    return {
      name: 1,
      hn: 2,
      age: 3,
      comorbidity: 4,
      serviceDate: 5,
      dxDate: 7,
      dept: 9,
      diagnosis: 10,
      septicShock: 11,
      atb: 12,
      atbDate: 13,
      culture: 15,
      pathogen: 17,
      patientStatus: 19,
      definiteDx: 20,
      site: 21,
      typeInf: 22,
      definiteStatus: 23,
      zone: 24,
    };
  }
  // old: 2565-2566 (no age separate col, no time cols)
  return {
    name: 1,
    hn: 2,
    age: null,
    comorbidity: 3,
    serviceDate: 4,
    dxDate: 5,
    dept: -1,
    diagnosis: 6,
    septicShock: null,
    atb: 7,
    atbDate: -1,
    culture: 8,
    pathogen: 10,
    patientStatus: 12,
    definiteDx: 13,
    site: 14,
    typeInf: 15,
    definiteStatus: 16,
    zone: 17,
  };
}

// ─── Parse ────────────────────────────────────────────────────────────────────
function parseXlsx(filePath: string): SepsisRow[] {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const rows: SepsisRow[] = [];

  const sheetYearMap: Record<string, string> = {};
  wb.SheetNames.forEach((n) => {
    const m = n.trim().match(/(\d{4})/);
    if (m)
      sheetYearMap[n] = String(
        parseInt(m[1]) > 2400 ? parseInt(m[1]) - 543 : parseInt(m[1]) + 543,
      );
    // e.g. "2569" → CE 2026 (display as 2569), keep thai year as label
  });

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
    }) as unknown[][];
    if (raw.length < 2) continue;

    const thaiYear = sheetName.trim().replace(/\s+/g, "");
    const layout = detectLayout(raw[0] as unknown[]);
    const cm = getColMap(layout);

    for (let i = 1; i < raw.length; i++) {
      const r = raw[i] as unknown[];
      // must have name
      const name = toStr(r[cm.name]);
      if (!name || name === "ลำดับ") continue;

      const serviceDate = toDateStr(r[cm.serviceDate]);
      const dxDate = toDateStr(r[cm.dxDate]);

      const definiteStatus = toStr(
        cm.definiteStatus >= 0 ? r[cm.definiteStatus] : null,
      );
      const patientStatus = toStr(
        cm.patientStatus >= 0 ? r[cm.patientStatus] : null,
      );
      const siteRaw = toStr(cm.site >= 0 ? r[cm.site] : null);
      const typeRaw = toStr(cm.typeInf >= 0 ? r[cm.typeInf] : null);
      const zoneRaw = toStr(cm.zone >= 0 ? r[cm.zone] : null);

      let septicShock: boolean | null = null;
      if (cm.septicShock != null) {
        const sv = toStr(r[cm.septicShock]);
        if (sv)
          septicShock =
            sv === "ใช่" || sv.toLowerCase() === "yes" || sv === "1";
      }

      rows.push({
        no: toNum(r[0]) ?? i,
        year: thaiYear,
        name,
        hn: r[cm.hn] != null ? String(Math.round(Number(r[cm.hn]) || 0)) : "",
        age: cm.age != null ? toNum(r[cm.age]) : null,
        comorbidity: toStr(r[cm.comorbidity]),
        serviceDate,
        dxDate,
        department: toStr(cm.dept >= 0 ? r[cm.dept] : null) || "ไม่ระบุ",
        diagnosis: toStr(r[cm.diagnosis]),
        septicShock,
        atb: toStr(r[cm.atb]),
        atbDate: toDateStr(r[cm.atbDate] ?? null),
        cultureType: toStr(r[cm.culture]),
        pathogen: normPathogen(toStr(r[cm.pathogen])),
        patientStatus,
        definiteDx: toStr(r[cm.definiteDx]),
        siteOfInfection: normSite(siteRaw),
        typeOfInfection: typeRaw || "ไม่ระบุ",
        definiteStatus,
        zone: normZone(zoneRaw),
      });
    }
  }

  return rows;
}

// ─── Aggregate ───────────────────────────────────────────────────────────────
function countBy(
  rows: SepsisRow[],
  key: keyof SepsisRow,
): Record<string, number> {
  const m: Record<string, number> = {};
  rows.forEach((r) => {
    const v = String(r[key] ?? "ไม่ระบุ").trim() || "ไม่ระบุ";
    m[v] = (m[v] || 0) + 1;
  });
  return m;
}

function buildYearSummary(year: string, rows: SepsisRow[]): SepsisByYear {
  const total = rows.length;
  const dead = rows.filter((r) => r.definiteStatus === "Dead").length;
  const improve = rows.filter((r) => r.definiteStatus === "Improve").length;
  const admit = rows.filter((r) => r.patientStatus === "Admit").length;
  const shock = rows.filter((r) => r.septicShock === true).length;
  const community = rows.filter(
    (r) => r.typeOfInfection === "Community",
  ).length;
  const nosocomial = rows.filter(
    (r) => r.typeOfInfection === "Nosocomial",
  ).length;

  const ages = rows
    .map((r) => r.age)
    .filter((a): a is number => a != null && a > 0 && a < 120);
  const avgAge =
    ages.length > 0
      ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
      : 0;

  const byAgeGroup: Record<string, number> = {
    "< 15 ปี": 0,
    "15-29 ปี": 0,
    "30-44 ปี": 0,
    "45-59 ปี": 0,
    "60-74 ปี": 0,
    "≥ 75 ปี": 0,
  };
  ages.forEach((a) => {
    if (a < 15) byAgeGroup["< 15 ปี"]++;
    else if (a < 30) byAgeGroup["15-29 ปี"]++;
    else if (a < 45) byAgeGroup["30-44 ปี"]++;
    else if (a < 60) byAgeGroup["45-59 ปี"]++;
    else if (a < 75) byAgeGroup["60-74 ปี"]++;
    else byAgeGroup["≥ 75 ปี"]++;
  });

  const monthMap: Record<string, number> = {};
  rows.forEach((r) => {
    const lbl = monthLabel(r.serviceDate || r.dxDate);
    if (lbl) monthMap[lbl] = (monthMap[lbl] || 0) + 1;
  });
  const byMonth = Object.entries(monthMap).map(([month, count]) => ({
    month,
    count,
  }));

  // Comorbidity (multi-value per patient)
  const byComorbidity: Record<string, number> = {};
  rows.forEach((r) => {
    normComorbidity(r.comorbidity).forEach((c) => {
      byComorbidity[c] = (byComorbidity[c] || 0) + 1;
    });
  });

  return {
    year,
    total,
    admit,
    dead,
    improve,
    septicShock: shock,
    mortalityRate: total > 0 ? Math.round((dead / total) * 1000) / 10 : 0,
    community,
    nosocomial,
    bySite: countBy(rows, "siteOfInfection"),
    byDept: countBy(rows, "department"),
    byPathogen: countBy(rows, "pathogen"),
    byZone: countBy(rows, "zone"),
    byComorbidity,
    byMonth,
    avgAge,
    byAgeGroup,
  };
}

function buildSummary(rows: SepsisRow[]): SepsisSummary {
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
    dead: y.dead,
    mortalityRate: y.mortalityRate,
  }));

  const allPathogen: Record<string, number> = {};
  const allSite: Record<string, number> = {};
  const allZone: Record<string, number> = {};
  const allDept: Record<string, number> = {};
  const allComorbidity: Record<string, number> = {};

  rows.forEach((r) => {
    allPathogen[r.pathogen] = (allPathogen[r.pathogen] || 0) + 1;
    allSite[r.siteOfInfection] = (allSite[r.siteOfInfection] || 0) + 1;
    allZone[r.zone] = (allZone[r.zone] || 0) + 1;
    allDept[r.department] = (allDept[r.department] || 0) + 1;
    normComorbidity(r.comorbidity).forEach((c) => {
      allComorbidity[c] = (allComorbidity[c] || 0) + 1;
    });
  });

  return {
    total: rows.length,
    byYear,
    yearlyTrend,
    allPathogen,
    allSite,
    allZone,
    allDept,
    allComorbidity,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "sepsis.xlsx");
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "ไม่พบไฟล์ data/sepsis.xlsx — กรุณาอัปโหลดข้อมูลก่อน" },
        { status: 404 },
      );
    }
    const rows = parseXlsx(filePath);
    const summary = buildSummary(rows);
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      summary,
      rows,
    } satisfies SepsisDashboardData);
  } catch (err) {
    console.error("SepsisDashboard error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
