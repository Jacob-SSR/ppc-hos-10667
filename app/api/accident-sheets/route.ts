// app/api/accident-sheets/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.ACCIDENT_SPREADSHEET_ID!;

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

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ─── แปลงวันที่ทุกรูปแบบ → "YYYY-MM-DD" (CE) ─────────────────────────────────
function normalizeDate(raw: string): string {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return "";
  const s = raw.trim();

  // Excel serial number (เช่น 45678) — Sheets บางครั้ง format เป็นตัวเลข
  const serial = Number(s);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dy = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${dy}`;
  }

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    let y = parseInt(m[1]);
    if (y > 2400) y -= 543;
    return `${y}-${m[2]}-${m[3]}`;
  }

  // DD/MM/YYYY หรือ D/M/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    let y = parseInt(m[3]);
    if (y > 2400) y -= 543;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  // DD-MM-YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) {
    let y = parseInt(m[3]);
    if (y > 2400) y -= 543;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  // YYYY/MM/DD
  m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (m) {
    let y = parseInt(m[1]);
    if (y > 2400) y -= 543;
    return `${y}-${m[2]}-${m[3]}`;
  }

  // Thai long format เช่น "15 มีนาคม 2568"
  const THAI_MONTHS_LONG: Record<string, string> = {
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
    พฤศจิกายน: "11",
    ธันวาคม: "12",
  };
  for (const [th, mm] of Object.entries(THAI_MONTHS_LONG)) {
    if (s.includes(th)) {
      const nums = s.match(/(\d+)/g);
      if (nums && nums.length >= 2) {
        const day = nums[0].padStart(2, "0");
        let year = parseInt(nums[nums.length - 1]);
        if (year > 2400) year -= 543;
        return `${year}-${mm}-${day}`;
      }
    }
  }

  return "";
}

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

    const treatDate = normalizeDate(treatDateRaw) || treatDateRaw;

    rows.push({
      no: toNum(get(row, "no")) || i,
      hn,
      age: toNum(get(row, "age")),
      sex: get(row, "sex"),
      treatDate,
      accidentDate:
        normalizeDate(get(row, "accidentDate")) || get(row, "accidentDate"),
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
  const avgAge =
    ages.length > 0
      ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
      : 0;
  const minAge = ages.length > 0 ? Math.min(...ages) : 0;
  const maxAge = ages.length > 0 ? Math.max(...ages) : 0;

  const count = (arr: AccidentRow[], key: keyof AccidentRow) => {
    const map: Record<string, number> = {};
    arr.forEach((r) => {
      const v = String(r[key] || "ไม่ระบุ").trim() || "ไม่ระบุ";
      map[v] = (map[v] || 0) + 1;
    });
    return map;
  };

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

  // byDay — รับเฉพาะ YYYY-MM-DD ที่ valid
  const dayMap: Record<string, number> = {};
  rows.forEach((r) => {
    const d = r.treatDate?.slice(0, 10) ?? "";
    if (d.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      dayMap[d] = (dayMap[d] || 0) + 1;
    }
  });
  const byDay = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, c]) => ({ date, count: c }));

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
    byVehicle: count(rows, "vehicle"),
    bySeverity: count(rows, "severity"),
    byTambon: count(rows, "tambon"),
    byTimeSlot,
    byStatus: count(rows, "status"),
    byProtection: count(rows, "protection"),
    byAgeGroup,
    byDay,
    byRoad: count(rows, "road"),
  };
}

export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const sheets = await getSheetClient();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const firstSheet = meta.data.sheets?.[0]?.properties?.title ?? "Sheet1";

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${firstSheet}!A:Z`,
    });

    const raw = (res.data.values ?? []) as string[][];
    const { rows, headers, sampleRow } = parseRows(raw);
    const summary = buildSummary(rows);

    // Debug: ดู raw treatDate ของแต่ละ row
    if (debug) {
      return NextResponse.json({
        headers,
        sampleRow,
        treatDateSamples: rows.slice(0, 10).map((r) => ({
          hn: r.hn,
          treatDate: r.treatDate,
        })),
        byDayCount: summary.byDay.length,
        totalRows: rows.length,
      });
    }

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sheetName: firstSheet,
      rows,
      summary,
    });
  } catch (err) {
    console.error("AccidentSheets error:", err);
    return NextResponse.json(
      {
        error:
          "ดึงข้อมูลจาก Google Sheets ไม่สำเร็จ: " + (err as Error).message,
      },
      { status: 500 },
    );
  }
}
