// app/api/anc-anemia-map/route.ts
import { NextResponse } from "next/server";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  sheetsError,
} from "@/lib/sheets";
import { getAncAnemiaMapRows } from "@/lib/anc.service";
import { cachedQuery } from "@/lib/cache";

export const dynamic = "force-dynamic";

// ─── Cache TTL ────────────────────────────────────────────────────────────────
// Sheets API ช้า + มีโควตา → cache ผลรวม 15 นาที, ดัชนีพิกัด 30 นาที
const TTL_RESULT = 900;
const TTL_COORD_INDEX = 1800;

// ─── แหล่งข้อมูลพิกัด (ชุดเดียวกับ drug-map / homeward-map) ─────────────────────
const PIKAD_SPREADSHEET_ID = process.env.PIKAD_SPREADSHEET_ID!;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AnemiaMapPoint {
  id: number;
  hn: string;
  fullName: string;
  address: string;
  tambon: string;
  hct: number | null; // ค่า HCT ต่ำสุด (%)
  severity: string; // เล็กน้อย / ปานกลาง / รุนแรง
  age: number;
  testDate: string; // วันที่ตรวจล่าสุด (YYYY-MM-DD)
  yearBE: string; // ปี พ.ศ. ที่ตรวจ เช่น "2568"
  monthName: string; // เดือนที่ตรวจ (ชื่อย่อไทย) เช่น "พ.ย."
  serviceMonth: string; // ป้ายเดือน+ปี เช่น "พ.ย. 2568" (ใช้ใน popup)
  lat: number;
  lng: number;
  mapLink: string;
}

export interface AnemiaMapUnmatched {
  hn: string;
  fullName: string;
  tambon: string;
}

export interface AnemiaMapData {
  updatedAt: string;
  start: string;
  end: string;
  total: number; // ผู้ป่วยซีด HCT < 33% ทั้งหมด (distinct คน — ตรงกับการ์ด KPI ของ dashboard)
  matched: number; // จับคู่พิกัดได้
  unmatched: number; // ไม่พบพิกัด
  points: AnemiaMapPoint[];
  unmatchedList: AnemiaMapUnmatched[];
  filters: {
    tambon: string[];
    severity: string[];
    year: string[]; // ปี พ.ศ. (ล่าสุดก่อน)
    month: string[]; // ชื่อเดือนย่อไทย (ม.ค. → ธ.ค.)
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** เหลือเฉพาะตัวเลข (เลขบัตรมาได้ทั้งแบบมีขีด/ไม่มีขีด) */
function normId(v: unknown): string {
  return toStr(v).replace(/\D/g, "");
}

/** "14.6668/103.1029" หรือ "14.6668,103.1029" → {lat,lng} */
function parseLatLng(s: string): { lat: number; lng: number } | null {
  if (!s) return null;
  const sep = s.includes("/") ? "/" : ",";
  const [a, b] = s.split(sep);
  const lat = parseFloat((a || "").trim());
  const lng = parseFloat((b || "").trim());
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  // กรอบประเทศไทย — กันพิกัดกรอกผิด
  if (lat < 5.4 || lat > 20.6 || lng < 97.2 || lng > 105.8) return null;
  return { lat, lng };
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

// ── เดือนที่ตรวจ (ป้ายภาษาไทย ปี พ.ศ. เต็ม เช่น "พ.ย. 2568") ──
const THAI_M = [
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
/** "2025-11" (ค.ศ.) → "พ.ย. 2568" */
function monthLabelBE(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  if (!y || isNaN(idx) || idx < 0 || idx > 11) return "";
  return `${THAI_M[idx]} ${parseInt(y) + 543}`;
}

/** ระดับความรุนแรงจาก HCT (หญิงตั้งครรภ์): <21 รุนแรง, <30 ปานกลาง, 30–32.9 เล็กน้อย */
function classifySeverity(
  hct: number | null,
): "เล็กน้อย" | "ปานกลาง" | "รุนแรง" {
  if (hct != null && hct > 0) {
    if (hct < 21) return "รุนแรง";
    if (hct < 30) return "ปานกลาง";
    return "เล็กน้อย"; // 30 – 32.9
  }
  return "เล็กน้อย";
}

/** ที่อยู่อ่านง่าย: "บ้านเลขที่ หมู่ X ต.ตำบล" */
function composeAddress(
  addrpart: string,
  moopart: string,
  tambon: string,
): string {
  const parts: string[] = [];
  if (addrpart) parts.push(addrpart);
  if (moopart) parts.push(`หมู่ ${moopart}`);
  if (tambon) parts.push(`ต.${tambon}`);
  return parts.join(" ").trim();
}

// ─── อ่านชีตพิกัด → Map<เลข13หลัก, {lat,lng,mapLink}> ─────────────────────────
type CoordEntry = { lat: number; lng: number; mapLink: string };

async function buildCoordIndex(): Promise<Map<string, CoordEntry>> {
  const sheets = await getSheetClient();
  const first =
    (await getAllSheetTitles(sheets, PIKAD_SPREADSHEET_ID))[0] ?? "Sheet1";
  // A=ละติจูด/ลองจิจูด  B=ชื่อ-นามสกุล  C=เลข13หลัก  D=วันเกิด  E=ลิ้งพิกัด
  const raw = await getValues(sheets, PIKAD_SPREADSHEET_ID, `${first}!A2:E`);

  const idx = new Map<string, CoordEntry>();
  for (const row of raw) {
    if (!row || row.length < 3) continue;
    const id = normId(row[2]);
    if (id.length !== 13) continue;
    if (idx.has(id)) continue; // ใช้พิกัดแรกที่เจอ
    const c = parseLatLng(toStr(row[0]));
    if (!c) continue;
    idx.set(id, { lat: c.lat, lng: c.lng, mapLink: toStr(row[4]) });
  }
  return idx;
}

/** เวอร์ชันมี cache — Map serialize ตรง ๆ ไม่ได้ ต้องแปลงเป็น entries ก่อน */
async function buildCoordIndexCached(): Promise<Map<string, CoordEntry>> {
  const entries = await cachedQuery<[string, CoordEntry][]>(
    ["pikad-coord-index"],
    async () => [...(await buildCoordIndex()).entries()],
    TTL_COORD_INDEX,
  );
  return new Map(entries);
}

// ย้อนหลังกี่ปีงบ — default = 1 (ปีงบปัจจุบัน ให้ยอดตรงกับ anc-nursing-dashboard)
// ตั้ง ANC_ANEMIA_MAP_LOOKBACK_FY=3 ใน .env ถ้าอยากดูย้อนหลังหลายปี
const LOOKBACK_FY = Math.max(
  1,
  parseInt(process.env.ANC_ANEMIA_MAP_LOOKBACK_FY ?? "1", 10) || 1,
);

/** ช่วงเริ่มต้น: ย้อนหลัง LOOKBACK_FY ปีงบ ถึงวันนี้ (timezone Asia/Bangkok) */
function defaultRange(): { start: string; end: string } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  const fyStartYear = m >= 9 ? y : y - 1; // ต.ค. = เดือน 9
  const startYear = fyStartYear - (LOOKBACK_FY - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${startYear}-10-01`,
    end: `${y}-${pad(m + 1)}-${pad(now.getDate())}`,
  };
}

// ─── สร้างข้อมูลแผนที่ (ถูกเรียกเฉพาะตอน cache miss) ──────────────────────────
async function buildAnemiaMapData(
  start: string,
  end: string,
): Promise<AnemiaMapData> {
  // ── ดึงคู่ขนาน: ทะเบียนซีด (SQL) + ดัชนีพิกัด (Sheet, cache 30 นาที) ──
  const [rows, coordIdx] = await Promise.all([
    getAncAnemiaMapRows(start, end),
    buildCoordIndexCached(),
  ]);

  const points: AnemiaMapPoint[] = [];
  const unmatchedList: AnemiaMapUnmatched[] = [];
  const yearSet = new Set<string>();
  const monthSet = new Set<string>();

  for (const r of rows) {
    const fullName = toStr(r.ptname).trim();
    const hn = toStr(r.hn);
    const tambon = toStr(r.tmb_name).trim();
    const address = composeAddress(
      toStr(r.addrpart).trim(),
      toStr(r.moopart).trim(),
      tambon,
    );

    const id13 = normId(r.cid);
    const coord = id13.length === 13 ? coordIdx.get(id13) : undefined;

    if (!coord) {
      unmatchedList.push({ hn, fullName, tambon });
      continue;
    }

    const hct = r.hct != null ? Number(r.hct) : null;
    const severity = classifySeverity(hct);

    const testDate = toStr(r.last_date).slice(0, 10);
    const ym = /^\d{4}-\d{2}/.test(testDate) ? testDate.slice(0, 7) : "";
    const [yyyy, mm] = ym ? ym.split("-") : ["", ""];
    const yearBE = yyyy ? String(parseInt(yyyy, 10) + 543) : "";
    const monthIdx = mm ? parseInt(mm, 10) - 1 : -1;
    const monthName = monthIdx >= 0 && monthIdx < 12 ? THAI_M[monthIdx] : "";
    const serviceMonth = ym ? monthLabelBE(ym) : "";
    if (yearBE) yearSet.add(yearBE);
    if (monthName) monthSet.add(monthName);

    points.push({
      id: points.length + 1,
      hn,
      fullName,
      address,
      tambon,
      hct,
      severity,
      age: Number(r.age_y ?? 0),
      testDate,
      yearBE,
      monthName,
      serviceMonth,
      lat: coord.lat,
      lng: coord.lng,
      mapLink: coord.mapLink,
    });
  }

  const SEV_ORDER = ["รุนแรง", "ปานกลาง", "เล็กน้อย"];
  return {
    updatedAt: new Date().toISOString(),
    start,
    end,
    total: rows.length,
    matched: points.length,
    unmatched: unmatchedList.length,
    points,
    unmatchedList,
    filters: {
      tambon: uniq(points.map((p) => p.tambon)).sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
      severity: SEV_ORDER.filter((s) => points.some((p) => p.severity === s)),
      year: [...yearSet].sort((a, b) => b.localeCompare(a)), // ปีล่าสุดก่อน
      month: THAI_M.filter((m) => monthSet.has(m)), // ม.ค. → ธ.ค.
    },
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const def = defaultRange();
    const start = url.searchParams.get("start") || def.start;
    const end = url.searchParams.get("end") || def.end;

    const data = await cachedQuery(
      ["anc-anemia-map", start, end],
      () => buildAnemiaMapData(start, end),
      TTL_RESULT,
    );

    return NextResponse.json(data);
  } catch (err) {
    return sheetsError(err, "AncAnemiaMap");
  }
}
