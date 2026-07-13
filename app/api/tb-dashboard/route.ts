// app/api/tb-sheets/route.ts
import { NextResponse } from "next/server";
import { cachedQuery } from "@/lib/cache";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  sheetsError,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

const SPREADSHEET_ID = process.env.TB_SPREADSHEET_ID!;

// cache 10 นาที — ทะเบียนผู้ป่วย TB คีย์มือลง Sheets ไม่ realtime
// (hard TTL ใน lib/cache.ts = ttl * 4 → stale แจกต่อได้ ~40 นาทีถ้า Sheets ล่ม/โควต้าหมด)
const TTL_SECONDS = 600;
const CACHE_KEY = "tb-sheets";

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
  startDate: string; // "YYYY-MM-DD" (ค.ศ.) สำหรับ sort
  outcome: string;
  concludeDate: string;
  note: string;
  // ผู้ป่วยดื้อยา RR/MDR/XDR (ตรวจจาก outcome/regType/regimen/note ตอน parse)
  // ใช้ตัดออกจากตัวหาร Success Rate ตามข้อ 7.1.2
  drugResistant: boolean;
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
  // Success Rate ตามเกณฑ์ตัวชี้วัดจังหวัด: คำนวณเฉพาะผู้ป่วยที่ขึ้นทะเบียนใน
  // ไตรมาสที่ 1 ของปีงบประมาณ (เดือน 10-12 = ต.ค.-ธ.ค.) เป้าหมาย ≥ ร้อยละ 88
  q1Total: number;
  q1Cured: number;
  q1Completed: number;
  successRateQ1: number;
  // Death rate ตามเกณฑ์ข้อ 3: นับเฉพาะ cohort ไตรมาส 1 (ไม่รวมตายจากอุบัติเหตุ)
  q1Died: number;
  mortalityRateQ1: number;
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
  sheetName: string;
  summary: TBSummary;
  rows: TBRow[];
}

// ─── Normalizers ──────────────────────────────────────────────────────────────
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

// จำแนกผลการรักษาโดยดูหมายเหตุด้วย: การตายจากอุบัติเหตุแยกจากการตายจาก TB (ข้อ 3)
function classifyOutcome(raw: string, note: string): string {
  const o = normOutcome(raw);
  if (o === "Died" && isAccidentalDeath(note)) return "เสียชีวิต (อุบัติเหตุ)";
  return o;
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

// "DD/MM/YYYY" (พ.ศ.) → "YYYY-MM-DD" (ค.ศ.) สำหรับ sort/group
function parseThaiDateStr(v: unknown): string {
  if (!v) return "";
  const s = String(v).trim();
  let y: number;
  let mo: string;
  let d: string;

  // รูปแบบ dd/mm/yyyy (เช่น 19/04/2569)
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    d = m1[1].padStart(2, "0");
    mo = m1[2].padStart(2, "0");
    y = parseInt(m1[3]);
  } else {
    // รูปแบบ yyyy-mm-dd (อาจมีเวลาต่อท้าย) เช่น "2569-04-19 00:00:00"
    const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m2) return s;
    y = parseInt(m2[1]);
    mo = m2[2].padStart(2, "0");
    d = m2[3].padStart(2, "0");
  }

  // แก้ปีพิมพ์ผิด: 19xx ในบริบทวันที่ พ.ศ. มักหมายถึง 25xx (เช่น 1969 → 2569)
  if (y >= 1900 && y <= 1999) y += 600;
  if (y > 2400) y -= 543; // พ.ศ. → ค.ศ.
  // ข้อมูลลงทะเบียน TB ควรอยู่ในช่วงที่สมเหตุสมผล (ค.ศ. 2015-2100)
  if (y < 2015 || y > 2100) return s;
  return `${y}-${mo}-${d}`;
}

// เรียงลำดับ label เดือน (เช่น "ต.ค. 68") ตามลำดับเวลา
export function monthSortKey(label: string): number {
  const parts = label.split(" ");
  if (parts.length < 2) return 0;
  const IDX: Record<string, number> = {
    "ม.ค.": 1,
    "ก.พ.": 2,
    "มี.ค.": 3,
    "เม.ย.": 4,
    "พ.ค.": 5,
    "มิ.ย.": 6,
    "ก.ค.": 7,
    "ส.ค.": 8,
    "ก.ย.": 9,
    "ต.ค.": 10,
    "พ.ย.": 11,
    "ธ.ค.": 12,
  };
  const y = parseInt(parts[1]) || 0;
  return y * 100 + (IDX[parts[0]] || 0);
}

function monthLabelFromDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return "";
  const y = parseInt(dateStr.slice(0, 4));
  const m = parseInt(dateStr.slice(5, 7));
  // เรียงตามเดือนปฏิทิน (ม.ค.=1 ... ธ.ค.=12) ให้ตรงกับเลขเดือนที่ใช้ index
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
  const thY = String(y + 543).slice(2);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${thY}` : `${m}/${thY}`;
}

function toNumOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}

// ไตรมาสที่ 1 ของปีงบประมาณ = เดือน ต.ค.-ธ.ค. (เดือน 10, 11, 12)
function isQ1Start(dateStr: string): boolean {
  if (!dateStr || dateStr.length < 7) return false;
  const m = parseInt(dateStr.slice(5, 7));
  return m === 10 || m === 11 || m === 12;
}

// ─── ตัวช่วยจำแนกตามเงื่อนไขการคำนวณ Success Rate (ข้อ 7 ของตัวชี้วัด) ──────────
// 7.1.1 นับเฉพาะ "รายใหม่ (New)" — ตัดผู้ป่วยที่ไม่ใช่รายใหม่ออกจากตัวหาร
// ครอบคลุมค่าจริงในชีต: Relapse, Treatment After Failure, TB ระยะแฝง (latent), ฯลฯ
function isNotNewCase(regType: string): boolean {
  const r = regType.toLowerCase();
  return (
    r.includes("relapse") ||
    r.includes("กลับเป็นซ้ำ") ||
    r.includes("กลับซ้ำ") ||
    r.includes("รักษาซ้ำ") ||
    /\bre[- ]?treat/.test(r) ||
    r.includes("treatment after failure") ||
    r.includes("treatment after loss") ||
    r.includes("after failure") ||
    r.includes("after default") ||
    r.includes("transfer in") ||
    r.includes("รับโอน") ||
    // Latent TB / TB ระยะแฝง — ไม่ใช่วัณโรคปอด active
    r.includes("ระยะแฝง") ||
    r.includes("latent") ||
    /\bltbi\b/.test(r)
  );
}

// 7.1.1 ตัดวัณโรค "นอกปอด" (extrapulmonary) — นับเฉพาะวัณโรคปอด
function isExtrapulmonary(regType: string, note: string): boolean {
  const t = `${regType} ${note}`.toLowerCase();
  return (
    t.includes("extrapulmonary") ||
    t.includes("extra-pulmonary") ||
    t.includes("นอกปอด") ||
    /\bep[- ]?tb\b/.test(t)
  );
}

// 7.1.2 ตรวจ RR-TB / MDR-TB / XDR-TB (ดื้อยา) จากข้อความในหลายคอลัมน์
function detectDrugResistant(
  outcome: string,
  regType: string,
  regimen: string,
  note: string,
): boolean {
  const t = `${outcome} ${regType} ${regimen} ${note}`.toUpperCase();
  return (
    /\bRR[\/ -]?MDR\b/.test(t) ||
    /\bRR[- ]?TB\b/.test(t) ||
    /\bMDR[- ]?TB\b/.test(t) ||
    /\bXDR[- ]?TB\b/.test(t) ||
    /\bPRE[- ]?XDR\b/.test(t) ||
    /\bRR\b/.test(t) ||
    /\bMDR\b/.test(t) ||
    /\bXDR\b/.test(t) ||
    t.includes("ดื้อยา") ||
    t.includes("RIFAMPICIN RESISTANT")
  );
}

// ผู้ป่วยเข้าเกณฑ์นับ Success Rate (ตัวหาร) หรือไม่: รายใหม่/วัณโรคปอด/ไม่ดื้อยา
function isQ1Denominator(r: TBRow): boolean {
  if (isNotNewCase(r.regType)) return false;
  if (isExtrapulmonary(r.regType, r.note)) return false;
  if (r.drugResistant) return false;
  return true;
}

// ข้อ 3: การเสียชีวิต "ไม่นับรวม เสียชีวิตด้วยอุบัติเหตุ"
function isAccidentalDeath(note: string): boolean {
  const t = note.toLowerCase();
  return (
    t.includes("อุบัติเหตุ") ||
    t.includes("จมน้ำ") ||
    t.includes("จราจร") ||
    t.includes("รถชน") ||
    t.includes("รถคว่ำ") ||
    t.includes("accident") ||
    /\brta\b/.test(t)
  );
}

// ─── เลือกชีตข้อมูลผู้ป่วย ─────────────────────────────────────────────────────
async function pickPatientSheet(
  sheets: Awaited<ReturnType<typeof getSheetClient>>,
): Promise<string> {
  const titles = await getAllSheetTitles(sheets, SPREADSHEET_ID);
  const byName = titles.find(
    (t) => t.includes("ผู้ป่วย") || t.toLowerCase().includes("patient"),
  );
  if (byName) return byName;
  return titles[0] ?? "ผู้ป่วย";
}

// ─── Parse จาก Google Sheets values (string[][]) ──────────────────────────────
function parseRows(raw: string[][]): TBRow[] {
  if (raw.length < 2) return [];

  const header = raw[0].map((h) => toStr(h));
  const col = (kws: string[]): number => {
    for (const kw of kws) {
      const i = header.findIndex((h) =>
        h.toLowerCase().includes(kw.toLowerCase()),
      );
      if (i >= 0) return i;
    }
    return -1;
  };

  const cYear = col(["ปีงบ"]);
  const cHN = col(["hn"]);
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

  const get = (r: string[], i: number) => (i >= 0 ? toStr(r[i]) : "");

  const rows: TBRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((c) => !c || !String(c).trim())) continue;

    const hn = get(r, cHN);
    const name = get(r, cName);
    if (!hn && !name) continue;

    const rawOutcome = get(r, cOutcome);
    const rawRegType = get(r, cRegType);
    const rawRegimen = get(r, cRegimen);
    const rawNote = get(r, cNote);

    rows.push({
      year: (get(r, cYear) || "2568").replace(/\.0$/, ""),
      hn,
      sitthi: get(r, cSitthi),
      name,
      age: toNumOrNull(get(r, cAge)),
      tambon: normTambon(get(r, cTambon)),
      ud: get(r, cUD),
      regimen: rawRegimen,
      regType: rawRegType,
      cxr: normCXR(get(r, cCXR)),
      afb: normAFB(get(r, cAFB)),
      culture: get(r, cCulture),
      geneExpert: normGX(get(r, cGX)),
      hiv: normHIV(get(r, cHIV)),
      lft: get(r, cLFT),
      bunCr: get(r, cBunCr),
      startDate: parseThaiDateStr(get(r, cStart)),
      outcome: classifyOutcome(rawOutcome, rawNote),
      concludeDate: parseThaiDateStr(get(r, cConclude)),
      note: rawNote,
      drugResistant: detectDrugResistant(
        rawOutcome,
        rawRegType,
        rawRegimen,
        rawNote,
      ),
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

  // Success Rate เฉพาะผู้ป่วยที่ขึ้นทะเบียนไตรมาส 1 (ต.ค.-ธ.ค.) ตามเกณฑ์ตัวชี้วัด
  // ตัวหาร (ข้อ 7): นับเฉพาะ "รายใหม่ วัณโรคปอด" — ตัด Relapse / นอกปอด / RR-MDR-XDR ออก
  const q1Rows = rows.filter(
    (r) => isQ1Start(r.startDate) && isQ1Denominator(r),
  );
  const q1Total = q1Rows.length;
  const q1Cured = q1Rows.filter((r) => r.outcome === "Cured").length;
  const q1Completed = q1Rows.filter((r) => r.outcome === "Completed").length;
  const successRateQ1 =
    q1Total > 0
      ? Math.round(((q1Cured + q1Completed) / q1Total) * 1000) / 10
      : 0;

  // Death rate (ข้อ 3): เฉพาะ cohort Q1 เดียวกัน ไม่นับตายด้วยอุบัติเหตุ
  const q1Died = q1Rows.filter(
    (r) => r.outcome === "Died" && !isAccidentalDeath(r.note),
  ).length;
  const mortalityRateQ1 =
    q1Total > 0 ? Math.round((q1Died / q1Total) * 1000) / 10 : 0;

  const ages = rows
    .map((r) => r.age)
    .filter((a): a is number => a != null && a > 0 && a < 120);
  const avgAge =
    ages.length > 0
      ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
      : 0;

  const monthMap: Record<string, number> = {};
  rows.forEach((r) => {
    const lbl = monthLabelFromDate(r.startDate);
    if (lbl) monthMap[lbl] = (monthMap[lbl] || 0) + 1;
  });
  const byMonth = Object.entries(monthMap)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month));

  const cohortMap: Record<string, Record<string, number>> = {};
  rows.forEach((r) => {
    const lbl = monthLabelFromDate(r.startDate);
    if (!lbl) return;
    if (!cohortMap[lbl]) cohortMap[lbl] = {};
    const o = r.outcome || "ไม่ระบุ";
    cohortMap[lbl][o] = (cohortMap[lbl][o] || 0) + 1;
  });

  const byUD: Record<string, number> = {};
  rows.forEach((r) => {
    normUD(r.ud).forEach((tag) => {
      byUD[tag] = (byUD[tag] || 0) + 1;
    });
  });

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
    q1Total,
    q1Cured,
    q1Completed,
    successRateQ1,
    q1Died,
    mortalityRateQ1,
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
    died: y.q1Died,
    successRate: y.successRateQ1,
  }));

  const allTambon: Record<string, number> = {};
  const allOutcome: Record<string, number> = {};
  rows.forEach((r) => {
    allTambon[r.tambon] = (allTambon[r.tambon] || 0) + 1;
    allOutcome[r.outcome] = (allOutcome[r.outcome] || 0) + 1;
  });

  return { total: rows.length, byYear, yearlyTrend, allTambon, allOutcome };
}

/** ดึงจาก Sheets + parse + สรุป — เก็บก้อนเดียวใน cache (รวม headers/sampleRow ให้ debug) */
async function buildTbSheetsData() {
  const sheets = await getSheetClient();
  const sheetName = await pickPatientSheet(sheets);
  const raw = await getValues(sheets, SPREADSHEET_ID, `${sheetName}!A:Z`);

  const rows = parseRows(raw);
  const summary = buildSummary(rows);

  return {
    updatedAt: new Date().toISOString(),
    sheetName,
    summary,
    rows,
    headers: raw[0] ?? [],
    sampleRow: raw[1] ?? [],
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const data = await cachedQuery([CACHE_KEY], buildTbSheetsData, TTL_SECONDS);

    if (debug) {
      return NextResponse.json({
        sheetName: data.sheetName,
        headers: data.headers,
        sampleRow: data.sampleRow,
        totalRows: data.rows.length,
        firstRows: data.rows.slice(0, 3),
        cachedAt: data.updatedAt,
      });
    }

    const { headers: _h, sampleRow: _s, ...publicData } = data;
    return NextResponse.json(publicData satisfies TBDashboardData);
  } catch (err) {
    return sheetsError(err, "TBSheets");
  }
}
