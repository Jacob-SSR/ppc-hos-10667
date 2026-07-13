// app/api/accident-sheets/route.ts  — REFACTORED + Redis cache
import { NextResponse } from "next/server";
import { cachedQuery } from "@/lib/cache";
import {
  getSheetClient,
  getFirstSheetTitle,
  getValues,
  toStr,
  toNum,
  countBy,
  parseDate,
  sheetsError,
} from "@/lib/sheets";

const SPREADSHEET_ID = process.env.ACCIDENT_SPREADSHEET_ID!;

// cache 10 นาที — ข้อมูลอุบัติเหตุคีย์มือลง Sheets ไม่ realtime
// (hard TTL ใน lib/cache.ts = ttl * 4 → มี stale แจกต่อได้ ~40 นาทีถ้า Sheets ล่ม/โควต้าหมด)
const TTL_SECONDS = 600;
const CACHE_KEY = "accident-sheets";

const COLUMN_MAP: Record<string, keyof AccidentRow> = {
  ลำดับ: "no",
  HN: "hn",
  อายุ: "age",
  เพศ: "sex",
  วันที่มารับการรักษา: "treatDate",
  วันที่เกิดเหตุ: "accidentDate",
  เวลาที่เกิด: "timeSlot",
  เอกสารพรบ: "prb",
  สิทธิการรักษา: "rights",
  ประเภทพาหนะ: "vehicle",
  ระดับความรุนแรง: "severity",
  ประเภท: "transport",
  ถนนที่เกิดเหตุ: "road",
  ตำบลที่เกิดเหตุ: "tambon",
  "respone time กรณีมีออก EMS": "responseTime",
  วินิจฉัยทางการแพทย์: "diagnosis",
  "mechanismof accident (รายละเอียดการบาดเจ็บ)": "mechanism",
  สถานะ: "status",
  ดื่มสุรา: "alcohol",
  การป้องกัน: "protection",
  ปัจจัยเสี่ยง: "riskFactor",
  ตรวจแอลกอฮอล์: "alcoholTest",
  ที่อยู่: "address",
  status: "finalStatus",
  หมายเหตุ: "note",
};

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

function parseRows(rawRows: string[][]): {
  rows: AccidentRow[];
  headers: string[];
  sampleRow: string[];
} {
  if (rawRows.length < 2) return { rows: [], headers: [], sampleRow: [] };

  const header = rawRows[0].map((h) => toStr(h));
  const colIndex: Partial<Record<keyof AccidentRow, number>> = {};
  header.forEach((h, i) => {
    const key = COLUMN_MAP[h];
    if (key) colIndex[key] = i;
  });

  const get = (row: string[], key: keyof AccidentRow): string => {
    const idx = colIndex[key];
    return idx !== undefined ? toStr(row[idx]) : "";
  };

  const rows: AccidentRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every((c) => !c || !String(c).trim())) continue;

    const hn = get(row, "hn");
    const treatDateRaw = get(row, "treatDate");
    if (!hn && !treatDateRaw) continue;

    rows.push({
      no: toNum(get(row, "no")) || i,
      hn,
      age: toNum(get(row, "age")),
      sex: get(row, "sex"),
      treatDate: parseDate(treatDateRaw) || treatDateRaw,
      accidentDate:
        parseDate(get(row, "accidentDate")) || get(row, "accidentDate"),
      timeSlot: get(row, "timeSlot"),
      prb: get(row, "prb"),
      rights: get(row, "rights"),
      vehicle: get(row, "vehicle"),
      severity: get(row, "severity"),
      transport: get(row, "transport"),
      road: get(row, "road"),
      tambon: get(row, "tambon"),
      responseTime: get(row, "responseTime"),
      diagnosis: get(row, "diagnosis"),
      mechanism: get(row, "mechanism"),
      status: get(row, "status"),
      alcohol: get(row, "alcohol"),
      protection: get(row, "protection"),
      riskFactor: get(row, "riskFactor"),
      alcoholTest: get(row, "alcoholTest"),
      address: get(row, "address"),
      finalStatus: get(row, "finalStatus"),
      note: get(row, "note"),
    });
  }

  return { rows, headers: header, sampleRow: rawRows[1] ?? [] };
}

function buildSummary(rows: AccidentRow[]) {
  const total = rows.length;
  const dead = rows.filter((r) => r.status === "Dead").length;
  const admit = rows.filter((r) => r.status === "Admit").length;
  const refer = rows.filter((r) =>
    r.status.toLowerCase().includes("refer"),
  ).length;
  const followUp = rows.filter((r) => r.status === "follow up").length;
  const dc = rows.filter((r) => r.status === "D/C").length;
  const male = rows.filter((r) => r.sex === "ชาย").length;
  const female = rows.filter((r) => r.sex === "หญิง").length;
  const drinkCount = rows.filter((r) => r.alcohol === "ดื่ม").length;
  const motorcycleCount = rows.filter(
    (r) => r.vehicle === "จักรยานยนต์",
  ).length;
  const helmetWorn = rows.filter(
    (r) =>
      r.protection.includes("สวมหมวกนิรภัย") && !r.protection.includes("ไม่"),
  ).length;
  const helmetNot = rows.filter((r) =>
    r.protection.includes("ไม่สวมหมวก"),
  ).length;

  const ages = rows.map((r) => r.age).filter((a) => a > 0);
  const avgAge = ages.length
    ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
    : 0;
  const minAge = ages.length ? Math.min(...ages) : 0;
  const maxAge = ages.length ? Math.max(...ages) : 0;

  const byTimeSlot: Record<string, number> = {};
  rows.forEach((r) => {
    const t = r.timeSlot.trim() || "ไม่ระบุ";
    const key =
      t.includes("0.00-4") || t.includes("00:00")
        ? "00:00–04:00"
        : t.includes("4.00-") || t.includes("04:")
          ? "04:00–08:00"
          : (t.includes("8") || t.includes("08")) && t.includes("12")
            ? "08:00–12:00"
            : t.includes("12") && t.includes("16")
              ? "12:00–16:00"
              : t.includes("16")
                ? "16:00–20:00"
                : t.includes("20")
                  ? "20:00–24:00"
                  : t || "ไม่ระบุ";
    byTimeSlot[key] = (byTimeSlot[key] || 0) + 1;
  });

  const AGE_GROUPS = ["<15", "15-24", "25-34", "35-44", "45-54", "55+"];
  const byAgeGroup = AGE_GROUPS.map((g) => {
    const [lo, hi] =
      g === "<15"
        ? [0, 14]
        : g === "55+"
          ? [55, 999]
          : g.split("-").map(Number);
    const inGroup = rows.filter((r) => r.age >= lo && r.age <= hi);
    return {
      group: g,
      male: inGroup.filter((r) => r.sex === "ชาย").length,
      female: inGroup.filter((r) => r.sex === "หญิง").length,
    };
  });

  const dayMap: Record<string, number> = {};
  rows.forEach((r) => {
    const d = r.treatDate?.slice(0, 10) ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dayMap[d] = (dayMap[d] || 0) + 1;
  });
  const byDay = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    total,
    dead,
    admit,
    refer,
    dc,
    followUp,
    avgAge,
    minAge,
    maxAge,
    male,
    female,
    drinkCount,
    motorcycleCount,
    helmetWorn,
    helmetNot,
    byVehicle: countBy(rows, "vehicle"),
    bySeverity: countBy(rows, "severity"),
    byTambon: countBy(rows, "tambon"),
    byTimeSlot,
    byStatus: countBy(rows, "status"),
    byProtection: countBy(rows, "protection"),
    byAgeGroup,
    byDay,
    byRoad: countBy(rows, "road"),
  };
}

/** ดึงจาก Sheets + parse + สรุป — เก็บทั้งก้อนเดียวใน cache (รวม headers/sampleRow ไว้ให้ debug ใช้ด้วย) */
async function buildAccidentData() {
  const sheets = await getSheetClient();
  const firstSheet = await getFirstSheetTitle(sheets, SPREADSHEET_ID);
  const raw = await getValues(sheets, SPREADSHEET_ID, `${firstSheet}!A:Z`);

  const { rows, headers, sampleRow } = parseRows(raw);
  const summary = buildSummary(rows);

  return {
    updatedAt: new Date().toISOString(),
    sheetName: firstSheet,
    rows,
    summary,
    headers,
    sampleRow,
  };
}

export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const data = await cachedQuery([CACHE_KEY], buildAccidentData, TTL_SECONDS);

    if (debug) {
      return NextResponse.json({
        headers: data.headers,
        sampleRow: data.sampleRow,
        treatDateSamples: data.rows
          .slice(0, 10)
          .map((r) => ({ hn: r.hn, treatDate: r.treatDate })),
        byDayCount: data.summary.byDay.length,
        totalRows: data.rows.length,
        cachedAt: data.updatedAt, // ให้รู้ว่า debug กำลังดูข้อมูล ณ เวลาไหน
      });
    }

    const { headers: _h, sampleRow: _s, ...publicData } = data;
    return NextResponse.json(publicData);
  } catch (err) {
    return sheetsError(err, "AccidentSheets");
  }
}
