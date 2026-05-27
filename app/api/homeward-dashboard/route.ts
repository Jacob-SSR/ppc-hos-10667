// app/api/homeward-dashboard/route.ts
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";

export interface HomeWardRow {
  no: number;
  month: string;
  monthTh: string;
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
  byStatus: { compensated: number; pending: number };
  amountByTambon: Record<string, number>;
  tambonDrug: Record<string, Record<string, number>>;
}

export interface HomeWardDashboardData {
  updatedAt: string;
  summary: HomeWardSummary;
  rows: HomeWardRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function parseMonthKey(sheetName: string): string {
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
  return `${THAI_MONTHS[m] ?? m} ${String(parseInt(y) + 543).slice(2)}`;
}

function toDateStr(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) {
    const y = v.getFullYear() > 2400 ? v.getFullYear() - 543 : v.getFullYear();
    return `${y}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  return String(v).trim().slice(0, 10);
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return toDateStr(v);
  return String(v).trim();
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

function parseXlsx(filePath: string): HomeWardRow[] {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const rows: HomeWardRow[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
    }) as unknown[][];
    const monthKey = parseMonthKey(sheetName);

    // Detect if col 12 is extra "ชดเชย" (พฤศจิกายน has double ชดเชย col)
    // header row 0: col 12 = ชดเชย, check if col 13 is also ชดเชย or Pre adj.RW
    const header = (raw[0] as unknown[]) ?? [];
    const col13Label = toStr(header[13]).toLowerCase();
    const hasDoubleChod =
      col13Label.includes("ชดเชย") || col13Label.includes("pre");
    // offset: if double ชดเชย, data cols shift by 1
    const offset = hasDoubleChod ? 1 : 0;

    for (let i = 1; i < raw.length; i++) {
      const r = raw[i] as unknown[];
      if (!r[7]) continue; // ต้องมีชื่อ

      const chodRaw = r[12];
      const isComp =
        chodRaw != null &&
        String(chodRaw).trim() !== "" &&
        String(chodRaw).trim() !== "-";
      const chodAmount = isComp ? (toNum(chodRaw) ?? 0) : 0;

      rows.push({
        no: toNum(r[0]) ?? i,
        month: monthKey,
        monthTh: sheetName,
        admitDate: toDateStr(r[1]),
        dcDate: toDateStr(r[2]),
        daysStay: toNum(r[3]),
        ward: toStr(r[4]),
        sitthi: toStr(r[5]),
        an: r[6] != null ? String(Math.round(Number(r[6]))) : "",
        name: toStr(r[7]),
        pdx: toStr(r[8]),
        drugType: classifyDrug(toStr(r[8])),
        tambon: toStr(r[9]) || "ไม่ระบุ",
        age: toNum(r[10]),
        rpsst: toStr(r[11]) || "ไม่ระบุ",
        chodchey: chodAmount,
        preAdjRw: toNum(r[13 + offset]),
        adjRw: toNum(r[14 + offset]),
        rwPostAudit: toNum(r[15 + offset]),
        claimDate: toDateStr(r[16 + offset]),
        channel: toStr(r[17 + offset]),
        totalSubmitDays: toNum(r[18 + offset]),
        isCompensated: isComp,
      });
    }
  }
  return rows;
}

function buildSummary(rows: HomeWardRow[]): HomeWardSummary {
  const compensated = rows.filter((r) => r.isCompensated).length;
  const totalAmount = rows.reduce((s, r) => s + r.chodchey, 0);
  const totalAdjRw = rows.reduce((s, r) => s + (r.adjRw ?? 0), 0);
  const tambonSet = new Set(rows.map((r) => r.tambon));

  const countBy = (key: keyof HomeWardRow) => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      const v = String(r[key] ?? "ไม่ระบุ");
      m[v] = (m[v] || 0) + 1;
    });
    return m;
  };

  const monthMap: Record<string, number> = {};
  rows.forEach((r) => {
    monthMap[r.month] = (monthMap[r.month] || 0) + 1;
  });
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, count]) => ({ month: monthLabel(m), count }));

  const amountByTambon: Record<string, number> = {};
  rows.forEach((r) => {
    amountByTambon[r.tambon] = (amountByTambon[r.tambon] || 0) + r.chodchey;
  });

  // Stacked: tambon × drug
  const tambonDrug: Record<string, Record<string, number>> = {};
  rows.forEach((r) => {
    if (!tambonDrug[r.tambon]) tambonDrug[r.tambon] = {};
    tambonDrug[r.tambon][r.drugType] =
      (tambonDrug[r.tambon][r.drugType] || 0) + 1;
  });

  return {
    total: rows.length,
    compensated,
    pending: rows.length - compensated,
    totalAmount,
    totalAdjRw: Math.round(totalAdjRw * 100) / 100,
    tambonCount: tambonSet.size,
    byMonth,
    byTambon: countBy("tambon"),
    byDrug: countBy("drugType"),
    byRpsst: countBy("rpsst"),
    byStatus: { compensated, pending: rows.length - compensated },
    amountByTambon,
    tambonDrug,
  };
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "homeward.xlsx");
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "ไม่พบไฟล์ data/homeward.xlsx — กรุณาอัปโหลดข้อมูลก่อน" },
        { status: 404 },
      );
    }
    const rows = parseXlsx(filePath);
    const summary = buildSummary(rows);
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      summary,
      rows,
    } satisfies HomeWardDashboardData);
  } catch (err) {
    console.error("HomeWardDashboard error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
