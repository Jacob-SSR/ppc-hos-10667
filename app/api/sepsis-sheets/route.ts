// app/api/sepsis-sheets/route.ts
import { NextResponse } from "next/server";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  parseDate,
  sheetsError,
} from "@/lib/sheets";
import { getAddressByHn, type AddressParts } from "@/lib/sepsis.service";
import { cachedQuery } from "@/lib/cache";

// ─── Cache TTL ────────────────────────────────────────────────────────────────
// ทะเบียน Sepsis อัปเดตเป็นรอบ → ผลรวม 10 นาที, ที่อยู่จาก HosXP 1 ชม. (แทบไม่เปลี่ยน)
const TTL_RESULT = 600;
const TTL_ADDRESS = 3600;

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
  // ── เพิ่มใหม่ ──
  arrivalTime: string; // "HH:MM"
  dxTime: string;
  atbTime: string;
  doorToDxMin: number | null; // เวลามาถึง รพ. → Dx Sepsis (นาที)
  dxToAtbMin: number | null; // Dx Sepsis → ได้รับ ATB (นาที)
  address: string; // ที่อยู่จาก HosXP patient (join thaiaddress ตาม HN)
  // ── ที่อยู่แยกส่วน (จาก HosXP) ──
  houseNo: string; // เลขที่
  moo: string; // หมู่
  tambon: string; // ตำบล
  amphur: string; // อำเภอ
  changwat: string; // จังหวัด
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
  arrivalTime: number | null;
  dxDate: number;
  dxTime: number | null;
  dept: number;
  diagnosis: number;
  septicShock: number | null;
  atb: number;
  atbDate: number;
  atbTime: number | null;
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
    // 2569: มี เวลาที่มาถึง รพ./OPD/ER แยกคอลัมน์
    return {
      name: 1,
      hn: 2,
      age: 3,
      comorbidity: 4,
      serviceDate: 5,
      arrivalTime: 6,
      dxDate: 9,
      dxTime: 10,
      septicShock: 12,
      dept: 13,
      diagnosis: 14,
      atb: 15,
      atbDate: 16,
      atbTime: 17,
      culture: 18,
      pathogen: 20,
      patientStatus: 22,
      definiteDx: 23,
      site: 24,
      typeInf: 25,
      definiteStatus: 26,
      zone: 27,
    };
  }
  if (layout === "new") {
    // 2567-2568: มี เวลาที่มาถึง (เดี่ยว)
    return {
      name: 1,
      hn: 2,
      age: 3,
      comorbidity: 4,
      serviceDate: 5,
      arrivalTime: 6,
      dxDate: 7,
      dxTime: 8,
      dept: 9,
      diagnosis: 10,
      septicShock: 12,
      atb: 13,
      atbDate: 14,
      atbTime: 15,
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
  // old: 2565-2566 (ไม่มีคอลัมน์เวลา)
  return {
    name: 1,
    hn: 2,
    age: null,
    comorbidity: 3,
    serviceDate: 4,
    arrivalTime: null,
    dxDate: 5,
    dxTime: null,
    dept: -1,
    diagnosis: 6,
    septicShock: null,
    atb: 7,
    atbDate: -1,
    atbTime: null,
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

// แปลงค่าเวลาจากชีต → นาทีนับจากเที่ยงคืน
// รองรับ "H:MM[:SS]" (+AM/PM) และ float แบบ H.MM (เช่น 11.06 = 11:06, 10.5 = 10:50)
function parseClock(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "-") return null;

  const colon = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (colon) {
    let h = parseInt(colon[1], 10);
    const m = parseInt(colon[2], 10);
    const ap = colon[3]?.toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h <= 23 && m <= 59 ? h * 60 + m : null;
  }

  const num = Number(s);
  if (!isNaN(num) && isFinite(num) && num >= 0 && num < 24) {
    const h = Math.floor(num);
    const mm = Math.round((num - h) * 100); // ทศนิยม 2 ตำแหน่ง = นาที
    return mm <= 59 ? h * 60 + mm : null;
  }
  return null;
}

function minToClock(min: number | null): string {
  if (min == null) return "";
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// รวมวันที่ (YYYY-MM-DD) + เวลา (นาที) → นาทีสัมบูรณ์ เพื่อให้คร่อมเที่ยงคืนได้
function absMin(dateStr: string, clock: number | null): number | null {
  if (clock == null) return null;
  if (!dateStr) return clock;
  const t = Date.parse(dateStr + "T00:00:00Z");
  return isNaN(t) ? clock : Math.floor(t / 60000) + clock;
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
    const atbDate =
      cm.atbDate >= 0 ? parseDate(r[cm.atbDate], { validate: true }) : "";

    let septicShock: boolean | null = null;
    if (cm.septicShock != null && cm.septicShock >= 0) {
      const sv = toStr(r[cm.septicShock]);
      if (sv)
        septicShock = sv === "ใช่" || sv.toLowerCase() === "yes" || sv === "1";
    }

    // ── เวลา + ช่วงเวลา ──
    const get = (idx: number | null) =>
      idx != null && idx >= 0 ? parseClock(r[idx]) : null;
    const arrivalMin = get(cm.arrivalTime);
    const dxMin = get(cm.dxTime);
    const atbMin = get(cm.atbTime);

    const arrivalAbs = absMin(serviceDate, arrivalMin);
    const dxAbs = absMin(dxDate || serviceDate, dxMin);
    const atbAbs = absMin(atbDate || dxDate || serviceDate, atbMin);

    const span = (a: number | null, b: number | null): number | null => {
      if (a == null || b == null) return null;
      const d = b - a;
      return d >= 0 && d <= 1440 ? d : null; // ตัดค่าติดลบ/เกิน 24 ชม. (data error)
    };

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
      atbDate,
      cultureType: toStr(r[cm.culture]),
      pathogen: normPathogen(toStr(r[cm.pathogen])),
      patientStatus: toStr(r[cm.patientStatus]),
      definiteDx: toStr(r[cm.definiteDx]),
      siteOfInfection: normSite(siteRaw),
      typeOfInfection: typeRaw || "ไม่ระบุ",
      definiteStatus: toStr(r[cm.definiteStatus]),
      zone: normZone(zoneRaw),
      arrivalTime: minToClock(arrivalMin),
      dxTime: minToClock(dxMin),
      atbTime: minToClock(atbMin),
      doorToDxMin: span(arrivalAbs, dxAbs),
      dxToAtbMin: span(dxAbs, atbAbs),
      address: "", // เติมภายหลังจาก HosXP (ดู GET)
      houseNo: "",
      moo: "",
      tambon: "",
      amphur: "",
      changwat: "",
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

// ─── ที่อยู่จาก HosXP (มี cache ชั้นแยก TTL ยาว) ──────────────────────────────
// key ผูกกับ hash ของชุด HN → HN ชุดเดิมได้ cache เดิม, มีผู้ป่วยใหม่ = key ใหม่
async function getCachedAddressMap(hns: string[]) {
  const { createHash } = await import("crypto");
  const hash = createHash("md5")
    .update([...hns].sort().join(","))
    .digest("hex")
    .slice(0, 12);
  const cached = await cachedQuery<[string, AddressParts][]>(
    ["sepsis-address", hash],
    async () => [...(await getAddressByHn(hns)).entries()],
    TTL_ADDRESS,
  );
  return new Map(cached);
}

// ─── สร้าง payload เต็ม (ชีต + ที่อยู่ + summary) ─────────────────────────────
async function buildPayload() {
  const sheets = await getSheetClient();

  // ดึงรายชื่อ sheets ทั้งหมด
  const sheetNames = await getAllSheetTitles(sheets, SPREADSHEET_ID);

  // กรองเฉพาะ sheet ที่มีปีงบประมาณ (2565-2569)
  const yearSheets = sheetNames.filter((n) => /256[5-9]/.test(n));

  if (yearSheets.length === 0) {
    return {
      updatedAt: new Date().toISOString(),
      rows: [] as SepsisSheetRow[],
      summary: buildSummary([]),
      sheetNames,
    };
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

  // ── เติมที่อยู่จาก HosXP (patient + thaiaddress) ตาม HN ──
  // ถ้า DB ล่มไม่ให้ dashboard พัง → แสดง "-" แทน
  try {
    const hns = [...new Set(allRows.map((r) => r.hn).filter(Boolean))];
    if (hns.length > 0) {
      const addrMap = await getCachedAddressMap(hns);
      allRows.forEach((r) => {
        const a = addrMap.get(r.hn);
        if (!a) return;
        r.houseNo = a.houseNo;
        r.moo = a.moo;
        r.tambon = a.tambon;
        r.amphur = a.amphur;
        r.changwat = a.changwat;
        r.address = [
          a.houseNo,
          a.moo ? `ม.${a.moo}` : "",
          a.tambon ? `ต.${a.tambon}` : "",
          a.amphur ? `อ.${a.amphur}` : "",
          a.changwat ? `จ.${a.changwat}` : "",
        ]
          .filter(Boolean)
          .join(" ");
      });
    }
  } catch (e) {
    console.error("[SepsisSheets] address enrich failed:", e);
  }

  const summary = buildSummary(allRows);

  return {
    updatedAt: new Date().toISOString(),
    rows: allRows,
    summary,
    sheetNames: yearSheets,
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const payload = await cachedQuery(
      ["sepsis-sheets"],
      buildPayload,
      TTL_RESULT,
    );
    return NextResponse.json(payload);
  } catch (err) {
    return sheetsError(err, "SepsisSheets");
  }
}
