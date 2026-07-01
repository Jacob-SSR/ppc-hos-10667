import { NextResponse } from "next/server";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  toNum,
  toNumOrNull,
  sheetsError,
} from "@/lib/sheets";

// ─── แหล่งข้อมูล ───────────────────────────────────────────────────────────────
const HOMEWARD_SPREADSHEET_ID = process.env.HOMEWARD_SPREADSHEET_ID!;
const HOMEWARD_SHEET_NAME =
  process.env.HOMEWARD_SHEET_NAME ||
  "ชดเชย Home Ward +พลับพลารักษ์ By Natchanan";
const PIKAD_SPREADSHEET_ID =
  process.env.PIKAD_SPREADSHEET_ID ??
  "12tU32ntRHsBVWHRUMGh0CfHpclpQplghH__6yh08wp4";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HomeWardMapPoint {
  id: number;
  name: string;
  tambon: string;
  pdx: string;
  drugType: string; // ชนิดสารเสพติด (จำแนกจาก Pdx)
  ward: string;
  sitthi: string;
  age: number | null;
  admissions: number; // จำนวนครั้งที่ admit
  months: string[]; // เดือนที่รับบริการ (ล่าสุดก่อน)
  latestMonth: string;
  totalChodchey: number; // ยอดชดเชยรวม
  isCompensated: boolean; // มีอย่างน้อย 1 ครั้งที่ชดเชยแล้ว
  an: string;
  lat: number;
  lng: number;
  mapLink: string;
}

export interface HomeWardMapUnmatched {
  name: string;
  tambon: string;
}

export interface HomeWardMapData {
  updatedAt: string;
  sheetName: string;
  totalRecords: number; // จำนวนแถว (admission) ทั้งหมด
  totalPersons: number; // จำนวนคน (unique)
  matched: number; // คนที่จับคู่พิกัดได้
  unmatched: number;
  points: HomeWardMapPoint[];
  unmatchedList: HomeWardMapUnmatched[];
  filters: {
    tambon: string[];
    drugType: string[];
    status: string[];
    ward: string[];
    month: string[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PREFIXES = [
  "เด็กชาย",
  "เด็กหญิง",
  "นางสาว",
  "น.ส.",
  "ด.ช.",
  "ด.ญ.",
  "นาย",
  "นาง",
];

/** ตัดคำนำหน้า + ช่องว่าง เพื่อเทียบชื่อข้ามฟอร์แมต */
function nameKey(name: string): string {
  let n = toStr(name)
    .trim()
    .replace(/\u200b/g, "");
  for (const p of PREFIXES) {
    if (n.startsWith(p)) {
      n = n.slice(p.length);
      break;
    }
  }
  return n.replace(/\s+/g, "");
}

function parseLatLng(s: string): { lat: number; lng: number } | null {
  if (!s) return null;
  const sep = s.includes("/") ? "/" : ",";
  const [a, b] = s.split(sep);
  const lat = parseFloat((a || "").trim());
  const lng = parseFloat((b || "").trim());
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

/** จำแนกชนิดสารเสพติดจากรหัส Pdx (ICD-10 F1x/F20) */
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

const MONTH_ORDER: Record<string, number> = {
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
/** "พ.ย. 2025" → ค่าเรียงลำดับ (YYYYMM) */
function monthSortVal(m: string): number {
  const s = toStr(m);
  const ym = s.match(/(\d{4})/);
  const year = ym ? parseInt(ym[1]) : 0;
  const ce = year > 2500 ? year - 543 : year;
  let mm = 0;
  for (const [th, n] of Object.entries(MONTH_ORDER)) {
    if (s.includes(th)) {
      mm = n;
      break;
    }
  }
  return ce * 100 + mm;
}

// ─── อ่านชีตพิกัด → Map<ชื่อ(normalize), {lat,lng,mapLink}> ───────────────────
async function buildCoordIndexByName(): Promise<
  Map<string, { lat: number; lng: number; mapLink: string }>
> {
  const sheets = await getSheetClient();
  const first =
    (await getAllSheetTitles(sheets, PIKAD_SPREADSHEET_ID))[0] ?? "Sheet1";
  // A=ละติจูด/ลองจิจูด  B=ชื่อ-นามสกุล  C=เลข13หลัก  D=วันเกิด  E=ลิ้งพิกัด
  const raw = await getValues(sheets, PIKAD_SPREADSHEET_ID, `${first}!A2:E`);

  const idx = new Map<string, { lat: number; lng: number; mapLink: string }>();
  for (const row of raw) {
    if (!row || row.length < 2) continue;
    const key = nameKey(toStr(row[1]));
    if (!key || idx.has(key)) continue; // ชื่อซ้ำ → ใช้อันแรก
    const c = parseLatLng(toStr(row[0]));
    if (!c) continue;
    idx.set(key, { lat: c.lat, lng: c.lng, mapLink: toStr(row[4]) });
  }
  return idx;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    if (!HOMEWARD_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า HOMEWARD_SPREADSHEET_ID ใน .env" },
        { status: 500 },
      );
    }

    const sheets = await getSheetClient();
    const raw = await getValues(
      sheets,
      HOMEWARD_SPREADSHEET_ID,
      `${HOMEWARD_SHEET_NAME}!A:V`,
    );

    if (raw.length < 2) {
      return NextResponse.json(
        { error: `ชีต "${HOMEWARD_SHEET_NAME}" ไม่มีข้อมูล` },
        { status: 500 },
      );
    }

    // ── หา index คอลัมน์ (fuzzy + fallback offset ตามชีตนี้) ──
    const header = raw[0].map((h) =>
      toStr(h).toLowerCase().replace(/\s+/g, ""),
    );
    const col = (kw: string[], fallback: number): number => {
      for (const k of kw) {
        const kn = k.toLowerCase().replace(/\s+/g, "");
        const i = header.findIndex((h) => h.includes(kn));
        if (i >= 0) return i;
      }
      return fallback;
    };
    const cMonth = col(["เดือน/ปี", "เดือน"], 1);
    const cStatus = col(["status"], 2);
    const cWard = col(["ward"], 6);
    const cSitthi = col(["สิทธิ"], 7);
    const cAn = col(["an"], 8);
    const cName = col(["ชื่อ", "name"], 9);
    const cPdx = col(["วินิจฉัยหลัก", "pdx", "dx"], 10);
    const cTambon = col(["ตำบล", "tambon"], 11);
    const cAge = col(["อายุ", "age"], 12);
    const cChod = col(["ยอดชดเชยสุทธิ", "ชดเชย"], 14);

    // ── index พิกัดคู่ขนาน ──
    const coordIdx = await buildCoordIndexByName();

    // ── รวมเป็นราย "คน" (dedup ตามชื่อ) ──
    interface Agg {
      name: string;
      tambon: string;
      pdx: string;
      ward: string;
      sitthi: string;
      age: number | null;
      an: string;
      admissions: number;
      months: string[];
      totalChodchey: number;
      isCompensated: boolean;
      latestVal: number;
    }
    const byPerson = new Map<string, Agg>();
    let totalRecords = 0;

    for (let i = 1; i < raw.length; i++) {
      const r = raw[i];
      const name = cName >= 0 ? toStr(r[cName]) : "";
      if (!name.trim()) continue;
      totalRecords++;

      const key = nameKey(name);
      const month = toStr(r[cMonth]);
      const mv = monthSortVal(month);
      const status = toStr(r[cStatus]);
      const compensated = status === "ชดเชย";
      const chod = toNum(r[cChod]);
      const pdx = toStr(r[cPdx]);

      const cur = byPerson.get(key);
      if (!cur) {
        byPerson.set(key, {
          name: name.trim(),
          tambon: (cTambon >= 0 ? toStr(r[cTambon]) : "") || "ไม่ระบุ",
          pdx,
          ward: cWard >= 0 ? toStr(r[cWard]) : "",
          sitthi: cSitthi >= 0 ? toStr(r[cSitthi]) : "",
          age: cAge >= 0 ? toNumOrNull(r[cAge]) : null,
          an: cAn >= 0 ? toStr(r[cAn]) : "",
          admissions: 1,
          months: month ? [month] : [],
          totalChodchey: chod,
          isCompensated: compensated,
          latestVal: mv,
        });
      } else {
        cur.admissions++;
        cur.totalChodchey += chod;
        cur.isCompensated = cur.isCompensated || compensated;
        if (month && !cur.months.includes(month)) cur.months.push(month);
        // ใช้ข้อมูลของเดือนล่าสุดเป็นตัวหลัก
        if (mv >= cur.latestVal) {
          cur.latestVal = mv;
          if (pdx) cur.pdx = pdx;
          if (cTambon >= 0 && toStr(r[cTambon])) cur.tambon = toStr(r[cTambon]);
          if (cAge >= 0 && toNumOrNull(r[cAge]) !== null)
            cur.age = toNumOrNull(r[cAge]);
        }
      }
    }

    // ── สร้าง points + จับคู่พิกัด ──
    const points: HomeWardMapPoint[] = [];
    const unmatchedList: HomeWardMapUnmatched[] = [];

    for (const [key, a] of byPerson) {
      const coord = coordIdx.get(key);
      const sortedMonths = [...a.months].sort(
        (x, y) => monthSortVal(y) - monthSortVal(x),
      );
      if (!coord) {
        unmatchedList.push({ name: a.name, tambon: a.tambon });
        continue;
      }
      points.push({
        id: points.length + 1,
        name: a.name,
        tambon: a.tambon,
        pdx: a.pdx,
        drugType: classifyDrug(a.pdx),
        ward: a.ward,
        sitthi: a.sitthi,
        age: a.age,
        admissions: a.admissions,
        months: sortedMonths,
        latestMonth: sortedMonths[0] ?? "",
        totalChodchey: Math.round(a.totalChodchey * 100) / 100,
        isCompensated: a.isCompensated,
        an: a.an,
        lat: coord.lat,
        lng: coord.lng,
        mapLink: coord.mapLink,
      });
    }

    const result: HomeWardMapData = {
      updatedAt: new Date().toISOString(),
      sheetName: HOMEWARD_SHEET_NAME,
      totalRecords,
      totalPersons: byPerson.size,
      matched: points.length,
      unmatched: unmatchedList.length,
      points,
      unmatchedList,
      filters: {
        tambon: uniq(points.map((p) => p.tambon)).sort((a, b) =>
          a.localeCompare(b, "th"),
        ),
        drugType: uniq(points.map((p) => p.drugType)),
        status: ["ชดเชยแล้ว", "รอชดเชย"],
        ward: uniq(points.map((p) => p.ward)),
        month: uniq(points.flatMap((p) => p.months)).sort(
          (a, b) => monthSortVal(b) - monthSortVal(a),
        ),
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    return sheetsError(err, "HomeWardMap");
  }
}
