import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";

export interface AccidentRow {
  no: number;
  hn: string;
  age: number;
  sex: string;
  treatDate: string;
  accidentDate: string;
  timeSlot: string;
  prb: string;
  rights: string;
  vehicle: string;
  severity: string;
  transport: string;
  road: string;
  tambon: string;
  responseTime: string;
  diagnosis: string;
  mechanism: string;
  status: string;
  alcohol: string;
  protection: string;
  riskFactor: string;
  alcoholTest: string;
  address: string;
  finalStatus: string;
  note: string;
}

export interface AccidentSummary {
  total: number;
  dead: number;
  admit: number;
  refer: number;
  dc: number;
  followUp: number;
  avgAge: number;
  minAge: number;
  maxAge: number;
  male: number;
  female: number;
  drinkCount: number;
  motorcycleCount: number;
  helmetWorn: number;
  helmetNot: number;
  byVehicle: Record<string, number>;
  bySeverity: Record<string, number>;
  byTambon: Record<string, number>;
  byTimeSlot: Record<string, number>;
  byStatus: Record<string, number>;
  byProtection: Record<string, number>;
  byAgeGroup: { group: string; male: number; female: number }[];
  byDay: { date: string; count: number }[];
  byRoad: Record<string, number>;
}

export interface AccidentDashboardData {
  updatedAt: string;
  sheetName: string;
  rows: AccidentRow[];
  summary: AccidentSummary;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const y = v.getFullYear();
    const ce = y > 2400 ? y - 543 : y;
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${ce}-${m}-${d}`;
  }
  return String(v).trim();
}

function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function parseXlsx(filePath: string): { rows: AccidentRow[]; sheetName: string } {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const rows: AccidentRow[] = raw.map((r, i) => ({
    no: toNum(r["ลำดับ"] ?? i + 1),
    hn: toStr(r["HN"]),
    age: toNum(r["อายุ"]),
    sex: toStr(r["เพศ"]),
    treatDate: toStr(r["วันที่มารับการรักษา"]),
    accidentDate: toStr(r["วันที่เกิดเหตุ"]),
    timeSlot: toStr(r["เวลาที่เกิด"]),
    prb: toStr(r["เอกสารพรบ"]),
    rights: toStr(r["สิทธิการรักษา"]),
    vehicle: toStr(r["ประเภทพาหนะ"]),
    severity: toStr(r["ระดับความรุนแรง"]),
    transport: toStr(r["ประเภท"]),
    road: toStr(r["ถนนที่เกิดเหตุ"] ?? r["ถนนที่เกิดเหตุ\n"]),
    tambon: toStr(r["ตำบลที่เกิดเหตุ"]),
    responseTime: toStr(r["respone time กรณีมีออก EMS"]),
    diagnosis: toStr(r["วินิจฉัยทางการแพทย์"]),
    mechanism: toStr(r["mechanismof accident (รายละเอียดการบาดเจ็บ)"]),
    status: toStr(r["สถานะ"]),
    alcohol: toStr(r["ดื่มสุรา"]),
    protection: toStr(r["การป้องกัน"]),
    riskFactor: toStr(r["ปัจจัยเสี่ยง"]),
    alcoholTest: toStr(r["ตรวจแอลกอฮอล์"]),
    address: toStr(r["ที่อยู่"]),
    finalStatus: toStr(r["status"]),
    note: toStr(r["หมายเหตุ"]),
  }));

  return { rows, sheetName: sheetName.trim() };
}

function buildSummary(rows: AccidentRow[]): AccidentSummary {
  const total = rows.length;
  const dead = rows.filter((r) => r.status === "Dead").length;
  const admit = rows.filter((r) => r.status === "Admit").length;
  const refer = rows.filter((r) => r.status.toLowerCase().includes("refer")).length;
  const followUp = rows.filter((r) => r.status === "follow up").length;
  const dc = rows.filter((r) => r.status === "D/C").length;
  const male = rows.filter((r) => r.sex === "ชาย").length;
  const female = rows.filter((r) => r.sex === "หญิง").length;
  const drinkCount = rows.filter((r) => r.alcohol === "ดื่ม").length;
  const motorcycleCount = rows.filter((r) => r.vehicle === "จักรยานยนต์").length;
  const helmetWorn = rows.filter((r) => r.protection.includes("สวมหมวกนิรภัย") && !r.protection.includes("ไม่")).length;
  const helmetNot = rows.filter((r) => r.protection.includes("ไม่สวมหมวก")).length;

  const ages = rows.map((r) => r.age).filter((a) => a > 0);
  const avgAge = ages.length > 0 ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : 0;
  const minAge = ages.length > 0 ? Math.min(...ages) : 0;
  const maxAge = ages.length > 0 ? Math.max(...ages) : 0;

  const count = (arr: AccidentRow[], key: keyof AccidentRow) => {
    const m: Record<string, number> = {};
    arr.forEach((r) => {
      const v = String(r[key] || "ไม่ระบุ").trim() || "ไม่ระบุ";
      m[v] = (m[v] || 0) + 1;
    });
    return m;
  };

  const byVehicle = count(rows, "vehicle");
  const bySeverity = count(rows, "severity");
  const byTambon = count(rows, "tambon");
  const byStatus = count(rows, "status");
  const byProtection = count(rows, "protection");
  const byRoad = count(rows, "road");

  const timeOrder = [
    "0.00-4.00", "4.00-08.00", "8..00-12.00", "8.00-12.00",
    "12.00-16.00", "12.00-16.01", "16.00-20.00", "20.00-24.00",
  ];
  const byTimeSlot: Record<string, number> = {};
  rows.forEach((r) => {
    const t = r.timeSlot.trim() || "ไม่ระบุ";
    const normalized = t.replace("8..00", "08:00").replace(/\./g, ":").replace(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/, "$1:00–$3:00");
    const key = t.includes("0.00-4") ? "00:00–04:00"
      : t.includes("4.00-") ? "04:00–08:00"
      : t.includes("8") && (t.includes("12")) ? "08:00–12:00"
      : t.includes("12") && t.includes("16") ? "12:00–16:00"
      : t.includes("16") ? "16:00–20:00"
      : t.includes("20") ? "20:00–24:00"
      : t || "ไม่ระบุ";
    byTimeSlot[key] = (byTimeSlot[key] || 0) + 1;
  });

  const AGE_GROUPS = ["<15", "15-24", "25-34", "35-44", "45-54", "55+"];
  const byAgeGroup = AGE_GROUPS.map((g) => {
    const [lo, hi] = g === "<15" ? [0, 14] : g === "55+" ? [55, 999] : g.split("-").map(Number);
    const inGroup = rows.filter((r) => r.age >= lo && r.age <= hi);
    return {
      group: g,
      male: inGroup.filter((r) => r.sex === "ชาย").length,
      female: inGroup.filter((r) => r.sex === "หญิง").length,
    };
  });

  const dayMap: Record<string, number> = {};
  rows.forEach((r) => {
    const d = r.treatDate.slice(0, 10);
    if (d) dayMap[d] = (dayMap[d] || 0) + 1;
  });
  const byDay = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    total, dead, admit, refer, dc, followUp,
    avgAge, minAge, maxAge, male, female,
    drinkCount, motorcycleCount, helmetWorn, helmetNot,
    byVehicle, bySeverity, byTambon, byTimeSlot, byStatus, byProtection, byAgeGroup, byDay, byRoad,
  };
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "accident.xlsx");
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "ไม่พบไฟล์ data/accident.xlsx — กรุณาอัปโหลดข้อมูลก่อน" },
        { status: 404 }
      );
    }
    const { rows, sheetName } = parseXlsx(filePath);
    const summary = buildSummary(rows);
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sheetName,
      rows,
      summary,
    } satisfies AccidentDashboardData);
  } catch (err) {
    console.error("AccidentDashboard error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}