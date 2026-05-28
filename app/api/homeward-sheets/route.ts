// app/api/homeward-sheets/route.ts
// ดึงข้อมูล Home Ward ยาเสพติดจาก Google Sheets แบบ real-time
// Spreadsheet ID: 1yeHSn7ZM2APIk21LULNYS1ctT8UE-tteYZeTYj1xiPU
// แต่ละ sheet = รายเดือน เช่น "พฤศจิกายน 2568", "ธันวาคม 2568" ฯลฯ

import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID =
  process.env.HOMEWARD_SPREADSHEET_ID ||
  "1yeHSn7ZM2APIk21LULNYS1ctT8UE-tteYZeTYj1xiPU";

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
function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}

function toNumForce(v: unknown): number {
  return toNum(v) ?? 0;
}

// แปลงวันที่จาก Google Sheets (ได้เป็น string ต่างๆ) → YYYY-MM-DD
function parseDate(raw: string): string {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return "";
  const s = raw.trim();

  // DD/MM/YYYY (Thai year พ.ศ.)
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    let y = parseInt(m[3]);
    if (y > 2400) y -= 543;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    let y = parseInt(m[1]);
    if (y > 2400) y -= 543;
    return `${y}-${m[2]}-${m[3]}`;
  }

  // DD-MM-YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    let y = parseInt(m[3]);
    if (y > 2400) y -= 543;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  return "";
}

// แปลงชื่อ sheet เป็น "YYYY-MM" (CE)
const MONTH_ORDER: Record<string, string> = {
  พฤศจิกายน: "11",
  ธันวาคม: "12",
  มกราคม: "01",
  กุมภาพันธ์: "02",
  มีนาคม: "03",
  เมษายน: "04",
  พฤษภาคม: "05",
  มิถุนายน: "06",
  กรกฎาคม: "07",
  สิงหาคม: "08",
  กันยายน: "09",
  ตุลาคม: "10",
};

function sheetToMonthKey(sheetName: string): string {
  for (const [th, mm] of Object.entries(MONTH_ORDER)) {
    if (sheetName.includes(th)) {
      const match = sheetName.match(/(\d{4})/);
      if (match) {
        const y = parseInt(match[1]);
        const ce = y > 2500 ? y - 543 : y;
        return `${ce}-${mm}`;
      }
    }
  }
  return sheetName;
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

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getSheetClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

// ─── Parse one sheet ──────────────────────────────────────────────────────────
function parseSheet(
  sheetName: string,
  rawRows: string[][],
): HomeWardSheetRow[] {
  if (rawRows.length < 2) return [];

  const monthKey = sheetToMonthKey(sheetName);

  // Header row 0 — detect column offsets
  const header = rawRows[0].map((h) => toStr(h));

  // helper: find col index by keyword
  const col = (kws: string[]) => {
    for (const kw of kws) {
      const i = header.findIndex((h) =>
        h.toLowerCase().includes(kw.toLowerCase()),
      );
      if (i >= 0) return i;
    }
    return -1;
  };

  // คอลัมน์จากที่เห็นใน homeward-dashboard route:
  // 0=no, 1=admitDate, 2=dcDate, 3=daysStay, 4=ward, 5=sitthi, 6=an, 7=name
  // 8=pdx, 9=tambon, 10=age, 11=rpsst, 12=chodchey, 13+offset=preAdjRw, 14=adjRw
  // ถ้า dynamic ให้ fallback ไปใช้ position

  const cNo = col(["ลำดับ", "no"]) >= 0 ? col(["ลำดับ", "no"]) : 0;
  const cAdmit =
    col(["admit", "วันที่รับ", "วันเข้า"]) >= 0
      ? col(["admit", "วันที่รับ", "วันเข้า"])
      : 1;
  const cDc =
    col(["d/c", "dc", "จำหน่าย", "วันออก"]) >= 0
      ? col(["d/c", "dc", "จำหน่าย", "วันออก"])
      : 2;
  const cDays = col(["วัน", "day"]) >= 0 ? col(["วัน", "day"]) : 3;
  const cWard = col(["ward"]) >= 0 ? col(["ward"]) : 4;
  const cSitthi = col(["สิทธิ"]) >= 0 ? col(["สิทธิ"]) : 5;
  const cAn = col(["an"]) >= 0 ? col(["an"]) : 6;
  const cName = col(["ชื่อ", "name"]) >= 0 ? col(["ชื่อ", "name"]) : 7;
  const cPdx =
    col(["pdx", "วินิจฉัย", "dx"]) >= 0 ? col(["pdx", "วินิจฉัย", "dx"]) : 8;
  const cTambon = col(["ตำบล", "tambon"]) >= 0 ? col(["ตำบล", "tambon"]) : 9;
  const cAge = col(["อายุ", "age"]) >= 0 ? col(["อายุ", "age"]) : 10;
  const cRpsst =
    col(["รพ.สต", "rpsst", "สต."]) >= 0 ? col(["รพ.สต", "rpsst", "สต."]) : 11;
  const cChod = col(["ชดเชย"]) >= 0 ? col(["ชดเชย"]) : 12;

  // detect double ชดเชย col (บางเดือน)
  const col13Label = toStr(header[13]).toLowerCase();
  const hasDoubleChod =
    col13Label.includes("ชดเชย") || col13Label.includes("pre");
  const offset = hasDoubleChod ? 1 : 0;

  const cPreAdj = 13 + offset;
  const cAdj = 14 + offset;
  const cRwPost = 15 + offset;
  const cClaim = 16 + offset;
  const cChannel = 17 + offset;
  const cSubmit = 18 + offset;

  const rows: HomeWardSheetRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    const name = toStr(r[cName]);
    if (!name || name === "") continue; // skip empty rows

    const chodRaw = toStr(r[cChod]);
    const isCompensated =
      chodRaw !== "" &&
      chodRaw !== "-" &&
      chodRaw !== "0" &&
      chodRaw !== "0.00";
    const chodchey = toNumForce(r[cChod]);

    const pdx = toStr(r[cPdx]);
    const anRaw = toStr(r[cAn]);

    rows.push({
      no: toNum(r[cNo]) ?? i,
      month: monthKey,
      monthTh: sheetName,
      admitDate: parseDate(toStr(r[cAdmit])),
      dcDate: parseDate(toStr(r[cDc])),
      daysStay: toNum(r[cDays]),
      ward: toStr(r[cWard]),
      sitthi: toStr(r[cSitthi]),
      an: anRaw
        ? String(Math.round(Number(anRaw.replace(/,/g, "")) || 0) || anRaw)
        : "",
      name,
      pdx,
      drugType: classifyDrug(pdx),
      tambon: toStr(r[cTambon]) || "ไม่ระบุ",
      age: toNum(r[cAge]),
      rpsst: toStr(r[cRpsst]) || "ไม่ระบุ",
      chodchey,
      preAdjRw: toNum(r[cPreAdj]),
      adjRw: toNum(r[cAdj]),
      rwPostAudit: toNum(r[cRwPost]),
      claimDate: parseDate(toStr(r[cClaim])),
      channel: toStr(r[cChannel]),
      totalSubmitDays: toNum(r[cSubmit]),
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

    // ดึงรายชื่อ sheet ทั้งหมด
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const sheetNames = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title ?? "")
      .filter(Boolean);

    const allRows: HomeWardSheetRow[] = [];
    let firstDebug:
      | { sheetName: string; headers: string[]; sampleRow: string[] }
      | undefined;

    for (const sheetName of sheetNames) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:V`,
      });
      const raw = (res.data.values ?? []) as string[][];
      if (raw.length < 2) continue;

      if (debug && !firstDebug) {
        firstDebug = {
          sheetName,
          headers: raw[0] ?? [],
          sampleRow: raw[1] ?? [],
        };
      }

      const rows = parseSheet(sheetName, raw);
      allRows.push(...rows);
    }

    const summary = buildSummary(allRows);

    const response: HomeWardSheetsData = {
      updatedAt: new Date().toISOString(),
      sheets: sheetNames,
      rows: allRows,
      summary,
    };

    if (debug && firstDebug) {
      response.debug = firstDebug;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("HomewardSheets error:", err);
    return NextResponse.json(
      {
        error:
          "ดึงข้อมูลจาก Google Sheets ไม่สำเร็จ: " + (err as Error).message,
      },
      { status: 500 },
    );
  }
}
