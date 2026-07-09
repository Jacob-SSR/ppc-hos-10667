// app/api/tb-map/route.ts
import { NextResponse } from "next/server";
import {
  getSheetClient,
  getAllSheetTitles,
  getFirstSheetTitle,
  getValues,
  toStr,
  sheetsError,
} from "@/lib/sheets";
import { cachedQuery } from "@/lib/cache";

// ─── Cache TTL ────────────────────────────────────────────────────────────────
// ทะเบียน TB อัปเดตเป็นรอบ → ผลรวม 15 นาที, พิกัดบ้าน 30 นาที
const TTL_RESULT = 900;
const TTL_COORD_INDEX = 1800;

// ─── แหล่งข้อมูล ───────────────────────────────────────────────────────────────
const TB_SPREADSHEET_ID = process.env.TB_SPREADSHEET_ID!;
const PIKAD_SPREADSHEET_ID = process.env.PIKAD_SPREADSHEET_ID!;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface TBMapPoint {
  id: number;
  hn: string;
  fullName: string;
  address: string;
  tambon: string;
  year: string; // ปีงบ (พ.ศ.)
  age: number | null;
  ud: string; // โรคประจำตัว
  regType: string; // ประเภทขึ้นทะเบียน (New/Relapse ฯลฯ)
  regimen: string; // สูตรยา
  hiv: string;
  afb: string;
  outcome: string; // ผลการรักษา (normalize แล้ว)
  startDate: string; // "YYYY-MM-DD" (ค.ศ.)
  serviceMonth: string; // เดือนเริ่มรักษา เช่น "พ.ย. 2568"
  matchBy: "cid" | "name"; // วิธีจับคู่พิกัด
  lat: number;
  lng: number;
  mapLink: string;
}

export interface TBMapUnmatched {
  hn: string;
  fullName: string;
  tambon: string;
  year: string;
}

export interface TBMapData {
  updatedAt: string;
  sheetName: string;
  total: number;
  matched: number;
  unmatched: number;
  points: TBMapPoint[];
  unmatchedList: TBMapUnmatched[];
  filters: {
    year: string[];
    outcome: string[];
    tambon: string[];
    regType: string[];
    month: string[];
  };
}

// ─── Normalizers (ตามเกณฑ์เดียวกับ tb-dashboard) ──────────────────────────────
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

function normTambon(v: string): string {
  if (!v || v === "-") return "ไม่ระบุ";
  const r = v.trim();
  if (r.includes("สำเดา") || r.includes("สำะเดา")) return "สะเดา";
  if (r === "ป่่าชัน") return "ป่าชัน";
  if (r.includes("โคกขมิ้")) return "โคกขมิ้น";
  return r;
}

// "DD/MM/YYYY" (พ.ศ.) → "YYYY-MM-DD" (ค.ศ.) — รวม fix ปีพิมพ์ผิด 19xx → 25xx
function parseThaiDateStr(v: unknown): string {
  if (!v) return "";
  const s = String(v).trim();
  let y: number;
  let mo: string;
  let d: string;

  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    d = m1[1].padStart(2, "0");
    mo = m1[2].padStart(2, "0");
    y = parseInt(m1[3]);
  } else {
    const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m2) return "";
    y = parseInt(m2[1]);
    mo = m2[2].padStart(2, "0");
    d = m2[3].padStart(2, "0");
  }

  if (y >= 1900 && y <= 1999) y += 600; // เช่น 1969 → 2569
  if (y > 2400) y -= 543; // พ.ศ. → ค.ศ.
  if (y < 2015 || y > 2100) return "";
  return `${y}-${mo}-${d}`;
}

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
function monthLabelBE(dateStr: string): string {
  if (!/^\d{4}-\d{2}/.test(dateStr)) return "";
  const y = parseInt(dateStr.slice(0, 4));
  const idx = parseInt(dateStr.slice(5, 7), 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return "";
  return `${THAI_M[idx]} ${y + 543}`;
}

// ─── จับคู่พิกัด ───────────────────────────────────────────────────────────────
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

function normId(v: unknown): string {
  return toStr(v).replace(/\D/g, "");
}

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
  // กรอบประเทศไทย — กันพิกัดกรอกผิด (เช่น lat==lng ทำให้จุดไปตกต่างประเทศ)
  if (lat < 5.4 || lat > 20.6 || lng < 97.2 || lng > 105.8) return null;
  return { lat, lng };
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

type CoordEntry = { lat: number; lng: number; mapLink: string };

async function buildCoordIndexes(): Promise<{
  byCid: Map<string, CoordEntry>;
  byName: Map<string, CoordEntry>;
}> {
  const sheets = await getSheetClient();
  const first = await getFirstSheetTitle(sheets, PIKAD_SPREADSHEET_ID);
  // A=ละติจูด/ลองจิจูด  B=ชื่อ-นามสกุล  C=เลข13หลัก  D=วันเกิด  E=ลิ้งพิกัด
  const raw = await getValues(sheets, PIKAD_SPREADSHEET_ID, `${first}!A2:E`);

  const byCid = new Map<string, CoordEntry>();
  const byName = new Map<string, CoordEntry>();
  for (const row of raw) {
    if (!row || row.length < 2) continue;
    const c = parseLatLng(toStr(row[0]));
    if (!c) continue;
    const rec = { lat: c.lat, lng: c.lng, mapLink: toStr(row[4]) };
    const id = normId(row[2]);
    if (id.length === 13 && !byCid.has(id)) byCid.set(id, rec);
    const nk = nameKey(toStr(row[1]));
    if (nk && !byName.has(nk)) byName.set(nk, rec);
  }
  return { byCid, byName };
}

/** เวอร์ชันมี cache — key เดียวกับ minithan-map เพราะเป็นดัชนีชุดเดียวกัน */
async function buildCoordIndexesCached(): Promise<{
  byCid: Map<string, CoordEntry>;
  byName: Map<string, CoordEntry>;
}> {
  const cached = await cachedQuery<{
    byCid: [string, CoordEntry][];
    byName: [string, CoordEntry][];
  }>(
    ["pikad-coord-indexes-cid-name"],
    async () => {
      const { byCid, byName } = await buildCoordIndexes();
      return { byCid: [...byCid.entries()], byName: [...byName.entries()] };
    },
    TTL_COORD_INDEX,
  );
  return { byCid: new Map(cached.byCid), byName: new Map(cached.byName) };
}

// ─── เลือกชีตผู้ป่วย (logic เดียวกับ tb-dashboard) ────────────────────────────
async function pickPatientSheet(
  sheets: Awaited<ReturnType<typeof getSheetClient>>,
): Promise<string> {
  const titles = await getAllSheetTitles(sheets, TB_SPREADSHEET_ID);
  const byName = titles.find(
    (t) => t.includes("ผู้ป่วย") || t.toLowerCase().includes("patient"),
  );
  if (byName) return byName;
  return titles[0] ?? "ผู้ป่วย";
}

// ─── สร้างข้อมูลแผนที่ (ถูกเรียกเฉพาะตอน cache miss) ──────────────────────────
async function buildTBMapData(): Promise<TBMapData> {
  const sheets = await getSheetClient();
  const sheetName = await pickPatientSheet(sheets);
  const raw = await getValues(sheets, TB_SPREADSHEET_ID, `${sheetName}!A:Z`);

  if (raw.length < 2) {
    // throw เพื่อไม่ให้ error ถูก cache ค้าง 15 นาที
    throw new Error("ชีตวัณโรคไม่มีข้อมูล");
  }

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
  const cName = col(["ชื่อ-สกุล", "ชื่อ"]);
  const cCid = col(["เลขบัตร", "เลข13", "เลข 13", "บัตรประชาชน", "cid"]);
  const cAge = col(["อายุ"]);
  const cTambon = col(["ตำบล"]);
  const cAddr = col(["ที่อยู่", "บ้านเลขที่"]);
  const cUD = col(["โรคประจำตัว", "u/d"]);
  const cRegimen = col(["สูตรยา", "สูตร"]);
  const cRegType = col(["ประเภทขึ้นทะเบียน", "ประเภทการขึ้น"]);
  const cAFB = col(["afb"]);
  const cHIV = col(["hiv"]);
  const cStart = col(["วันที่เริ่มรักษา", "วันเริ่ม"]);
  const cOutcome = col(["ผลการรักษา", "outcome"]);

  const get = (r: string[], i: number) => (i >= 0 ? toStr(r[i]) : "");

  const { byCid, byName } = await buildCoordIndexesCached();

  // TB ชีตเดียวรวมหลายปีงบ — บางคนอาจมีหลายแถว (รักษาซ้ำ) จึงเก็บทุกแถวเป็นจุด
  const points: TBMapPoint[] = [];
  const unmatchedList: TBMapUnmatched[] = [];
  const monthKey = new Map<string, string>(); // label → sortable ym
  let total = 0;

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((c) => !toStr(c).trim())) continue;

    const hn = get(r, cHN);
    const name = get(r, cName);
    if (!hn && !name) continue;
    total++;

    const year = (get(r, cYear) || "ไม่ระบุ").replace(/\.0$/, "");
    const tambon = normTambon(get(r, cTambon));

    // จับคู่พิกัด: CID ก่อน (ถ้าชีตมีคอลัมน์เลขบัตร) แล้วค่อย fallback เป็นชื่อ
    const id13 = cCid >= 0 ? normId(r[cCid]) : "";
    let coord = id13.length === 13 ? byCid.get(id13) : undefined;
    let matchBy: "cid" | "name" = "cid";
    if (!coord) {
      coord = byName.get(nameKey(name));
      matchBy = "name";
    }

    if (!coord) {
      unmatchedList.push({ hn, fullName: name, tambon, year });
      continue;
    }

    const startDate = parseThaiDateStr(get(r, cStart));
    const serviceMonth = monthLabelBE(startDate);
    if (serviceMonth) monthKey.set(serviceMonth, startDate.slice(0, 7));

    points.push({
      id: points.length + 1,
      hn,
      fullName: name,
      address: get(r, cAddr),
      tambon,
      year,
      age: (() => {
        const n = Number(get(r, cAge).replace(/,/g, ""));
        return isNaN(n) || n <= 0 ? null : n;
      })(),
      ud: get(r, cUD),
      regType: get(r, cRegType),
      regimen: get(r, cRegimen),
      hiv: get(r, cHIV),
      afb: get(r, cAFB),
      outcome: normOutcome(get(r, cOutcome)),
      startDate,
      serviceMonth,
      matchBy,
      lat: coord.lat,
      lng: coord.lng,
      mapLink: coord.mapLink,
    });
  }

  return {
    updatedAt: new Date().toISOString(),
    sheetName,
    total,
    matched: points.length,
    unmatched: unmatchedList.length,
    points,
    unmatchedList,
    filters: {
      year: uniq(points.map((p) => p.year)).sort((a, b) =>
        b.localeCompare(a, "th"),
      ),
      outcome: uniq(points.map((p) => p.outcome)),
      tambon: uniq(points.map((p) => p.tambon)).sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
      regType: uniq(points.map((p) => p.regType)),
      month: [...monthKey.keys()].sort((a, b) =>
        (monthKey.get(b) ?? "").localeCompare(monthKey.get(a) ?? ""),
      ),
    },
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const data = await cachedQuery(["tb-map"], buildTBMapData, TTL_RESULT);

    return NextResponse.json(data);
  } catch (err) {
    return sheetsError(err, "TBMap");
  }
}
