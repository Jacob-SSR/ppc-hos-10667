// app/api/sepsis-sheets/route.ts
// ดึงข้อมูล Sepsis จาก Google Sheets แบบ real-time
// Spreadsheet ID: 13sNBF0oUkngCAS0Lxzs3fTYr2ywrDAYyU8b0-UMh08w
// Sheet แยกรายปี: 2569, 2568, 2567, 2566

import { NextResponse } from "next/server";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  parseDate,
  sheetsError,
} from "@/lib/sheets";

const SPREADSHEET_ID = process.env.Sepsis_SPREADSHEET_ID!;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SepsisSheetRow {
  no: number;
  year: string;
  name: string;
  hn: string;
  age: number | null;
  comorbidity: string;
  serviceDate: string;
  dxDate: string;
  department: string;
  diagnosis: string;
  septicShock: boolean | null;
  atb: string;
  atbDate: string;
  cultureType: string;
  pathogen: string;
  patientStatus: string;
  definiteDx: string;
  siteOfInfection: string;
  typeOfInfection: string;
  definiteStatus: string;
  zone: string;
}

// ─── Column map per layout ────────────────────────────────────────────────────
// ตรวจ layout จาก header row
function detectLayout(header: string[]): "new2569" | "new" | "old" {
  const h = header.map((v) => v.trim());
  // 2569 มีคอลัมน์ OPD/ER แยก
  if (h.some((v) => v.includes("OPD") || v.includes("วันที่ OPD")))
    return "new2569";
  // 2567-2568 มี Dx วันที่
  if (h.some((v) => v.includes("Dx") || v.includes("วินิจฉัย"))) return "new";
  return "old";
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
  // old: 2565-2566
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

// ─── Normalizers ──────────────────────────────────────────────────────────────
// toNum เฉพาะ sepsis — ใช้ Number(v) ตรงๆ (ไม่ strip comma) + เช็ค isFinite
// ต่างจาก toNumOrNull กลางที่ strip comma → เก็บ local ไว้เพื่อ behavior เดิม
function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) || !isFinite(n) ? null : n;
}

function normPathogen(raw: string): string {
  if (!raw || raw === "-") return "ไม่ระบุ";
  const r = raw.trim();
  if (/^ng/i.test(r)) return "No Growth";
  if (/contaminate/i.test(r)) return "Contaminate";
  if (/e\.?\s*coli|escherichia/i.test(r)) return "E. coli";
  if (/klebsiella/i.test(r)) return "Klebsiella spp.";
  if (/staphylococcus/i.test(r)) return "Staphylococcus spp.";
  if (/pseudomonas/i.test(r)) return "Pseudomonas spp.";
  if (/burkholderia/i.test(r)) return "Burkholderia spp.";
  if (/acinetobacter/i.test(r)) return "Acinetobacter spp.";
  if (/streptococcus/i.test(r)) return "Streptococcus spp.";
  if (/gnb|gram.?neg/i.test(r)) return "GNB";
  if (/gram.?pos/i.test(r)) return "Gram Positive";
  return r.length > 30 ? r.slice(0, 28) + "…" : r;
}

function normZone(raw: string): string {
  if (!raw || raw === "-") return "ไม่ระบุ";
  const r = raw.trim();
  if (r.includes("โคก")) return "โคกขมิ้น";
  if (r.includes("นอก")) return "นอกเขต";
  return r;
}

// normalize department — กรองค่าที่เป็นวันที่หรือตัวเลขออก
function normDept(raw: string): string {
  const d = raw?.trim() ?? "";
  if (!d || d === "-") return "ไม่ระบุ";
  // เป็นวันที่รูปแบบต่างๆ: 22/2/2023, 4/8/2565, 2023-01-01
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(d)) return "ไม่ระบุ";
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(d)) return "ไม่ระบุ";
  // ขึ้นต้นด้วยตัวเลข (น่าจะเป็น serial/วันที่)
  if (/^\d/.test(d)) return "ไม่ระบุ";
  return d;
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
  const t = raw?.trim() ?? "";
  return map[t] ?? (t || "ไม่ระบุ");
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

// ─── Parse one sheet ──────────────────────────────────────────────────────────
function parseSheet(raw: string[][], thaiYear: string): SepsisSheetRow[] {
  if (raw.length < 2) return [];
  const header = raw[0].map((h) => toStr(h));
  const layout = detectLayout(header);
  const cm = getColMap(layout);
  const rows: SepsisSheetRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    const name = toStr(r[cm.name]);
    if (!name || name === "ลำดับ" || name === "ชื่อ-สกุล") continue;

    const serviceDate = parseDate(r[cm.serviceDate], { validate: true });
    const dxDate =
      cm.dxDate >= 0 ? parseDate(r[cm.dxDate], { validate: true }) : "";

    let septicShock: boolean | null = null;
    if (cm.septicShock != null && cm.septicShock >= 0) {
      const sv = toStr(r[cm.septicShock]);
      if (sv)
        septicShock = sv === "ใช่" || sv.toLowerCase() === "yes" || sv === "1";
    }

    const hn = r[cm.hn] != null ? String(r[cm.hn]).trim() : "";
    const siteRaw = cm.site >= 0 ? toStr(r[cm.site]) : "";
    const typeRaw = cm.typeInf >= 0 ? toStr(r[cm.typeInf]) : "";
    const zoneRaw = cm.zone >= 0 ? toStr(r[cm.zone]) : "";

    rows.push({
      no: toNum(r[0]) ?? i,
      year: thaiYear,
      name,
      hn,
      age: cm.age != null ? toNum(r[cm.age]) : null,
      comorbidity: toStr(r[cm.comorbidity]),
      serviceDate,
      dxDate,
      department: normDept(cm.dept >= 0 ? toStr(r[cm.dept]) : ""),
      diagnosis: toStr(r[cm.diagnosis]),
      septicShock,
      atb: toStr(r[cm.atb]),
      atbDate:
        cm.atbDate >= 0 ? parseDate(r[cm.atbDate], { validate: true }) : "",
      cultureType: toStr(r[cm.culture]),
      pathogen: normPathogen(toStr(r[cm.pathogen])),
      patientStatus: toStr(r[cm.patientStatus]),
      definiteDx: toStr(r[cm.definiteDx]),
      siteOfInfection: normSite(siteRaw),
      typeOfInfection: typeRaw || "ไม่ระบุ",
      definiteStatus: toStr(r[cm.definiteStatus]),
      zone: normZone(zoneRaw),
    });
  }
  return rows;
}

// ─── Build summary ────────────────────────────────────────────────────────────
function buildSummary(rows: SepsisSheetRow[]) {
  const years = [...new Set(rows.map((r) => r.year))].sort();

  const byYear = years.map((y) => {
    const yr = rows.filter((r) => r.year === y);
    const total = yr.length;
    const dead = yr.filter((r) => r.definiteStatus === "Dead").length;
    const improve = yr.filter((r) => r.definiteStatus === "Improve").length;
    const admit = yr.filter((r) => r.patientStatus === "Admit").length;
    const shock = yr.filter((r) => r.septicShock === true).length;
    const community = yr.filter(
      (r) => r.typeOfInfection === "Community",
    ).length;
    const nosocomial = yr.filter(
      (r) => r.typeOfInfection === "Nosocomial",
    ).length;

    const ages = yr
      .map((r) => r.age)
      .filter((a): a is number => a != null && a > 0 && a < 120);
    const avgAge =
      ages.length > 0
        ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
        : 0;

    const countBy = (key: keyof SepsisSheetRow) => {
      const m: Record<string, number> = {};
      yr.forEach((r) => {
        const v = String(r[key] ?? "ไม่ระบุ").trim() || "ไม่ระบุ";
        m[v] = (m[v] || 0) + 1;
      });
      return m;
    };

    const byComorbidity: Record<string, number> = {};
    yr.forEach((r) => {
      normComorbidity(r.comorbidity).forEach((c) => {
        byComorbidity[c] = (byComorbidity[c] || 0) + 1;
      });
    });

    return {
      year: y,
      total,
      dead,
      improve,
      admit,
      septicShock: shock,
      mortalityRate: total > 0 ? Math.round((dead / total) * 1000) / 10 : 0,
      community,
      nosocomial,
      avgAge,
      bySite: countBy("siteOfInfection"),
      byDept: countBy("department"),
      byPathogen: countBy("pathogen"),
      byZone: countBy("zone"),
      byComorbidity,
    };
  });

  const yearlyTrend = byYear.map((y) => ({
    year: y.year,
    total: y.total,
    dead: y.dead,
    mortalityRate: y.mortalityRate,
  }));

  // All-time aggregates
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

  const total = rows.length;
  const dead = rows.filter((r) => r.definiteStatus === "Dead").length;

  return {
    total,
    dead,
    mortalityRate: total > 0 ? Math.round((dead / total) * 1000) / 10 : 0,
    byYear,
    yearlyTrend,
    allPathogen,
    allSite,
    allZone,
    allDept,
    allComorbidity,
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const sheets = await getSheetClient();

    // ดึงรายชื่อ sheets ทั้งหมด
    const sheetNames = await getAllSheetTitles(sheets, SPREADSHEET_ID);

    // กรองเฉพาะ sheet ที่มีปีงบประมาณ (2565-2569)
    const yearSheets = sheetNames.filter((n) => /256[5-9]/.test(n));

    if (yearSheets.length === 0) {
      return NextResponse.json({
        updatedAt: new Date().toISOString(),
        rows: [],
        summary: buildSummary([]),
        sheetNames,
      });
    }

    // ดึงข้อมูลทุก sheet พร้อมกัน
    const allRows: SepsisSheetRow[] = [];

    await Promise.all(
      yearSheets.map(async (sheetName) => {
        const raw = await getValues(sheets, SPREADSHEET_ID, `${sheetName}!A:Z`);
        const thaiYear = sheetName.trim().match(/(\d{4})/)?.[1] ?? sheetName;
        const parsed = parseSheet(raw, thaiYear);
        allRows.push(...parsed);
      }),
    );

    // เรียงตาม year แล้ว serviceDate
    allRows.sort((a, b) => {
      if (a.year !== b.year) return a.year.localeCompare(b.year);
      return (a.serviceDate || "").localeCompare(b.serviceDate || "");
    });

    const summary = buildSummary(allRows);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      rows: allRows,
      summary,
      sheetNames: yearSheets,
    });
  } catch (err) {
    return sheetsError(err, "SepsisSheets");
  }
}
