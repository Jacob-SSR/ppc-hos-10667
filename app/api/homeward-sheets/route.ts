import { NextResponse } from "next/server";
import {
  getSheetClient,
  getValues,
  toStr,
  toNum,
  toNumOrNull,
  parseDate as parseDateShared,
  sheetsError,
} from "@/lib/sheets";

const SPREADSHEET_ID = process.env.HOMEWARD_SPREADSHEET_ID!;

// ชื่อ sheet เดียวที่รวมข้อมูลทุกเดือน (Home Ward + พลับพลารักษ์)
const SHEET_NAME =
  process.env.HOMEWARD_SHEET_NAME ||
  "ชดเชย Home Ward +พลับพลารักษ์ By Natchanan";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HomeWardSheetRow {
  no: number;
  month: string; // "2568-11"
  monthTh: string; // "พฤศจิกายน 2568"
  admitDate: string;
  dcDate: string;
  daysStay: number | null;
  ward: string;
  sitthi: string;
  an: string;
  name: string;
  pdx: string;
  drugType: string;
  tambon: string;
  age: number | null;
  rpsst: string;
  chodchey: number;
  preAdjRw: number | null;
  adjRw: number | null;
  rwPostAudit: number | null;
  claimDate: string;
  channel: string;
  totalSubmitDays: number | null;
  isCompensated: boolean;
}

export interface HomeWardSheetsData {
  updatedAt: string;
  sheets: string[];
  rows: HomeWardSheetRow[];
  summary: HomeWardSummary;
  debug?: { sheetName: string; headers: string[]; sampleRow: string[] };
}

export interface HomeWardSummary {
  total: number;
  compensated: number;
  pending: number;
  totalAmount: number;
  totalAdjRw: number;
  tambonCount: number;
  byMonth: { month: string; count: number }[];
  byTambon: Record<string, number>;
  byDrug: Record<string, number>;
  byRpsst: Record<string, number>;
  amountByTambon: Record<string, number>;
  tambonDrug: Record<string, Record<string, number>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// homeward: chodchey ต้องเป็น number เสมอ (ไม่ใช่ null) → wrap toNumOrNull
function toNumForce(v: unknown): number {
  return toNumOrNull(v) ?? 0;
}

// parseDate เฉพาะ homeward — ปิด Excel serial เพื่อให้ตรง behavior เดิม
// (เดิม homeward.parseDate ไม่รองรับ serial และไม่ validate ช่วงปี)
function parseDate(raw: string): string {
  return parseDateShared(raw, { serial: false });
}

// แปลงค่าในคอลัมน์ "เดือน/ปีที่รับบริการ" เช่น "พ.ย. 2025", "มี.ค. 2026" → "YYYY-MM"
// (คอลัมน์นี้เป็นเดือนย่อไทย + ปี ค.ศ. อยู่แล้ว ไม่ต้องแปลง พ.ศ.)
const MONTH_SHORT_ORDER: Record<string, string> = {
  "ม.ค.": "01",
  "ก.พ.": "02",
  "มี.ค.": "03",
  "เม.ย.": "04",
  "พ.ค.": "05",
  "มิ.ย.": "06",
  "ก.ค.": "07",
  "ส.ค.": "08",
  "ก.ย.": "09",
  "ต.ค.": "10",
  "พ.ย.": "11",
  "ธ.ค.": "12",
};

function monthYearToKey(raw: string): string {
  const s = toStr(raw);
  for (const [th, mm] of Object.entries(MONTH_SHORT_ORDER)) {
    if (s.includes(th)) {
      const match = s.match(/(\d{4})/);
      if (match) {
        const y = parseInt(match[1]);
        const ce = y > 2500 ? y - 543 : y;
        return `${ce}-${mm}`;
      }
    }
  }
  return s;
}

const THAI_MONTHS_SHORT: Record<string, string> = {
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
  return `${THAI_MONTHS_SHORT[m] ?? m} ${String(parseInt(y) + 543).slice(2)}`;
}

function classifyDrug(pdx: string): string {
  if (!pdx) return "ไม่ระบุ";
  const p = pdx.trim().toUpperCase().replace(/\s+/g, "");
  if (p.startsWith("F10")) return "แอลกอฮอล์ (F10)";
  if (p.startsWith("F11")) return "ฝิ่น/Opioids (F11)";
  if (p.startsWith("F12")) return "กัญชา (F12)";
  if (p.startsWith("F13")) return "ยานอนหลับ (F13)";
  if (p.startsWith("F15")) return "ยาบ้า/Amphetamine (F15)";
  if (p.startsWith("F16")) return "ยาหลอนประสาท (F16)";
  if (p.startsWith("F18")) return "สารระเหย (F18)";
  if (p.startsWith("F19")) return "สารเสพติดหลายชนิด (F19)";
  if (p.startsWith("F20")) return "จิตเภท (F20)";
  if (p.startsWith("F")) return `อื่นๆ (${pdx.substring(0, 3)})`;
  return "ไม่ระบุ";
}

// ─── Parse sheet เดียว (รวมทุกเดือน) ────────────────────────────────────────────
// คอลัมน์ของ sheet "ชดเชย Home Ward +พลับพลารักษ์ By Natchanan":
// 0=ลำดับ, 1=เดือน/ปีที่รับบริการ, 2=Status, 3=วันที่รักษา, 4=วันที่จำหน่าย,
// 5=จำนวนวันนอน, 6=ward, 7=สิทธิ, 8=AN, 9=ชื่อ_นามสกุล, 10=วินิจฉัยหลัก,
// 11=ตำบล, 12=อายุ, 13=รพสต, 14=ยอดชดเชยสุทธิ Invoice, 15=AdjRw HOSxP,
// 16=AdjRw2 จากrep, 17=AdjRw จากrep, 18=วันที่ส่งเคลม, 19=resource,
// 20=ระยะเวลาส่งเคลม, 21=รหัสสถานพยาบาลรอง
function parseSheet(
  sheetName: string,
  rawRows: string[][],
): HomeWardSheetRow[] {
  if (rawRows.length < 2) return [];

  // Header row 0 — detect column offsets ตามชื่อคอลัมน์ (กันกรณี sheet ขยับคอลัมน์)
  const header = rawRows[0].map((h) => toStr(h));

  const col = (kws: string[], fallback: number) => {
    for (const kw of kws) {
      const i = header.findIndex((h) =>
        h.toLowerCase().includes(kw.toLowerCase()),
      );
      if (i >= 0) return i;
    }
    return fallback;
  };

  const cNo = col(["ลำดับ", "no"], 0);
  const cMonthYear = col(["เดือน/ปี", "เดือน"], 1);
  const cStatus = col(["status"], 2);
  const cAdmit = col(["วันที่รักษา", "admit"], 3);
  const cDc = col(["วันที่จำหน่าย", "d/c", "dc"], 4);
  const cDays = col(["จำนวนวันนอน", "วันนอน", "day"], 5);
  const cWard = col(["ward"], 6);
  const cSitthi = col(["สิทธิ"], 7);
  const cAn = col(["an"], 8);
  const cName = col(["ชื่อ", "name"], 9);
  const cPdx = col(["วินิจฉัยหลัก", "pdx", "dx"], 10);
  const cTambon = col(["ตำบล", "tambon"], 11);
  const cAge = col(["อายุ", "age"], 12);
  const cRpsst = col(["รพสต", "รพ.สต", "rpsst"], 13);
  const cChod = col(["ยอดชดเชยสุทธิ", "ชดเชย"], 14);
  const cPreAdj = col(["adjrw\n hosxp", "hosxp"], 15);
  const cRwPost = col(["adjrw2"], 16);
  const cAdj = col(["adjrw\nจากrep", "จากrep"], 17);
  const cClaim = col(["วันที่ส่งเคลม", "ส่งเคลม"], 18);
  const cChannel = col(["resource"], 19);
  const cSubmit = col(["ระยะเวลา"], 20);

  const rows: HomeWardSheetRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    const name = toStr(r[cName]);
    if (!name || name === "") continue; // skip empty rows

    const status = toStr(r[cStatus]);
    const isCompensated = status === "ชดเชย";
    const chodchey = toNumForce(r[cChod]);

    const pdx = toStr(r[cPdx]);
    const anRaw = toStr(r[cAn]);
    const monthTh = toStr(r[cMonthYear]) || sheetName;

    rows.push({
      no: toNumOrNull(r[cNo]) ?? i,
      month: monthYearToKey(monthTh),
      monthTh,
      admitDate: parseDate(toStr(r[cAdmit])),
      dcDate: parseDate(toStr(r[cDc])),
      daysStay: toNumOrNull(r[cDays]),
      ward: toStr(r[cWard]),
      sitthi: toStr(r[cSitthi]),
      an: anRaw
        ? String(Math.round(Number(anRaw.replace(/,/g, "")) || 0) || anRaw)
        : "",
      name,
      pdx,
      drugType: classifyDrug(pdx),
      tambon: toStr(r[cTambon]) || "ไม่ระบุ",
      age: toNumOrNull(r[cAge]),
      rpsst: toStr(r[cRpsst]) || "ไม่ระบุ",
      chodchey,
      preAdjRw: toNumOrNull(r[cPreAdj]),
      adjRw: toNumOrNull(r[cAdj]),
      rwPostAudit: toNumOrNull(r[cRwPost]),
      claimDate: parseDate(toStr(r[cClaim])),
      channel: toStr(r[cChannel]),
      totalSubmitDays: toNumOrNull(r[cSubmit]),
      isCompensated,
    });
  }

  return rows;
}

// ─── Build summary ────────────────────────────────────────────────────────────
function buildSummary(rows: HomeWardSheetRow[]): HomeWardSummary {
  const compensated = rows.filter((r) => r.isCompensated).length;
  const totalAmount = rows.reduce((s, r) => s + r.chodchey, 0);
  const totalAdjRw = rows.reduce((s, r) => s + (r.adjRw ?? 0), 0);
  const tambonSet = new Set(rows.map((r) => r.tambon));

  const monthMap: Record<string, number> = {};
  rows.forEach((r) => {
    monthMap[r.month] = (monthMap[r.month] || 0) + 1;
  });
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, count]) => ({ month: monthLabel(m), count }));

  const byTambon: Record<string, number> = {};
  const byDrug: Record<string, number> = {};
  const byRpsst: Record<string, number> = {};
  const amountByTambon: Record<string, number> = {};
  const tambonDrug: Record<string, Record<string, number>> = {};

  rows.forEach((r) => {
    byTambon[r.tambon] = (byTambon[r.tambon] || 0) + 1;
    byDrug[r.drugType] = (byDrug[r.drugType] || 0) + 1;
    byRpsst[r.rpsst] = (byRpsst[r.rpsst] || 0) + 1;
    amountByTambon[r.tambon] = (amountByTambon[r.tambon] || 0) + r.chodchey;
    if (!tambonDrug[r.tambon]) tambonDrug[r.tambon] = {};
    tambonDrug[r.tambon][r.drugType] =
      (tambonDrug[r.tambon][r.drugType] || 0) + 1;
  });

  return {
    total: rows.length,
    compensated,
    pending: rows.length - compensated,
    totalAmount: Math.round(totalAmount),
    totalAdjRw: Math.round(totalAdjRw * 100) / 100,
    tambonCount: tambonSet.size,
    byMonth,
    byTambon,
    byDrug,
    byRpsst,
    amountByTambon,
    tambonDrug,
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const sheets = await getSheetClient();

    // ดึงข้อมูลจาก sheet เดียวที่รวมทุกเดือน (Home Ward + พลับพลารักษ์)
    const raw = await getValues(sheets, SPREADSHEET_ID, `${SHEET_NAME}!A:V`);

    const allRows: HomeWardSheetRow[] =
      raw.length >= 2 ? parseSheet(SHEET_NAME, raw) : [];

    const summary = buildSummary(allRows);

    // รายชื่อเดือนที่มีข้อมูลจริง (เรียงตามลำดับเวลา) ใช้แสดงเป็น pills แทนชื่อ sheet เดิม
    const monthPills = [...new Set(allRows.map((r) => r.monthTh))].sort(
      (a, b) => monthYearToKey(a).localeCompare(monthYearToKey(b)),
    );

    const response: HomeWardSheetsData = {
      updatedAt: new Date().toISOString(),
      sheets: monthPills,
      rows: allRows,
      summary,
    };

    if (debug) {
      response.debug = {
        sheetName: SHEET_NAME,
        headers: raw[0] ?? [],
        sampleRow: raw[1] ?? [],
      };
    }

    return NextResponse.json(response);
  } catch (err) {
    return sheetsError(err, "HomewardSheets");
  }
}
