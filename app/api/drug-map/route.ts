// app/api/drug-map/route.ts
import { NextResponse } from "next/server";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  toNum,
  parseDate,
  sheetsError,
} from "@/lib/sheets";
import { cachedQuery } from "@/lib/cache";

// ─── Cache TTL ────────────────────────────────────────────────────────────────
// ชีตผู้ป่วยยาเสพติดอัปเดตเป็นรอบ → ผลรวม 15 นาที, พิกัดบ้าน 30 นาที
const TTL_RESULT = 900;
const TTL_COORD_INDEX = 1800;

// ─── แหล่งข้อมูล ───────────────────────────────────────────────────────────────
// ชีตผู้ป่วยยาเสพติด (ชุดเดียวกับ /api/drug-sheets)
const DRUG_SPREADSHEET_ID = process.env.DRUG_SPREADSHEET_ID!;
// ชีตพิกัดหลังคาเรือน (มี ละติจูด/ลองจิจูด + เลข 13 หลัก)
const PIKAD_SPREADSHEET_ID = process.env.PIKAD_SPREADSHEET_ID!;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DrugMapPoint {
  id: number;
  hn: string;
  prefix: string;
  firstName: string;
  lastName: string;
  fullName: string;
  address: string;
  tambon: string;
  color: string; // ระดับความรุนแรง: เขียว/เหลือง/ส้ม/แดง
  treatStatus: string; // ติดตาม/บำบัด/จำหน่าย
  detailStatus: string; // treat ครบ/Metrix/Dropout/IMC/Homeword
  program: string; // HW/IMC/MP ...
  referral: string; // วิธีการมาบำบัด
  v2Score: number;
  age: number;
  isNew: boolean;
  serviceMonth: string; // เดือนที่รับบริการ (เริ่มมาจริง) เช่น "พ.ย. 2568"
  lat: number;
  lng: number;
  mapLink: string;
}

export interface DrugMapUnmatched {
  hn: string;
  fullName: string;
  tambon: string;
}

export interface DrugMapData {
  updatedAt: string;
  total: number; // ผู้ป่วยยาเสพติดทั้งหมด
  matched: number; // จับคู่พิกัดได้
  unmatched: number; // ไม่พบพิกัด
  points: DrugMapPoint[];
  unmatchedList: DrugMapUnmatched[];
  filters: {
    tambon: string[];
    color: string[];
    treatStatus: string[];
    program: string[];
    referral: string[];
    month: string[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** เหลือเฉพาะตัวเลข (เลขบัตรมาได้ทั้งแบบมีขีด/ไม่มีขีด) */
function normId(v: unknown): string {
  return toStr(v).replace(/\D/g, "");
}

/** normalize สี — sheet มีทั้งพิมพ์ถูกและพิมพ์ผิด (เขึยว) */
function normalizeColor(raw: string): string {
  const r = raw.trim();
  if (!r) return "ไม่ระบุ";
  if (r.includes("เขี") || r.includes("เขึ") || r.toLowerCase() === "green")
    return "เขียว";
  if (r.includes("ส้ม") || r.toLowerCase() === "orange") return "ส้ม";
  if (r.includes("เหลือง") || r.toLowerCase() === "yellow") return "เหลือง";
  if (r.includes("แดง") || r.toLowerCase() === "red") return "แดง";
  return r;
}

/** "14.6668/103.1029" หรือ "14.6668,103.1029" → {lat,lng} */
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

/** unique + ตัดค่าว่าง */
function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

// ── เดือนที่รับบริการ (ป้ายภาษาไทย ปี พ.ศ. เต็ม เช่น "พ.ย. 2568") ──
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
/** parse วันที่ → "YYYY-MM" (ค.ศ.) ใช้จัดเรียงเดือน */
function ymFromDate(v: unknown): string {
  const d = parseDate(v, { validate: true });
  return /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : "";
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

/** เวอร์ชันมี cache — key เดียวกับ anc-anemia-map เพราะเป็นดัชนี CID ชุดเดียวกัน */
async function buildCoordIndexCached(): Promise<Map<string, CoordEntry>> {
  const entries = await cachedQuery<[string, CoordEntry][]>(
    ["pikad-coord-index"],
    async () => [...(await buildCoordIndex()).entries()],
    TTL_COORD_INDEX,
  );
  return new Map(entries);
}

// ─── สร้างข้อมูลแผนที่ (ถูกเรียกเฉพาะตอน cache miss) ──────────────────────────
async function buildDrugMapData(): Promise<DrugMapData> {
  const sheets = await getSheetClient();

  // ── 1) เลือกชีตผู้ป่วย (เหมือน /api/drug-sheets) ──
  const titles = await getAllSheetTitles(sheets, DRUG_SPREADSHEET_ID);
  const patientSheet =
    titles.find((t) => {
      const tl = t.toLowerCase();
      return (
        tl.includes("ผู้ป่วย") ||
        tl.includes("patient") ||
        tl.includes("ข้อมูล") ||
        tl.includes("data") ||
        tl.includes("drug")
      );
    }) ??
    titles[0] ??
    "Sheet1";

  const raw = await getValues(
    sheets,
    DRUG_SPREADSHEET_ID,
    `${patientSheet}!A:AJ`,
  );

  if (raw.length < 2) {
    // throw เพื่อไม่ให้ error ถูก cache ค้าง 15 นาที
    throw new Error("ชีตผู้ป่วยยาเสพติดไม่มีข้อมูล");
  }

  // ── 2) หา index คอลัมน์แบบ fuzzy ──
  const header = raw[0].map((h) => toStr(h).toLowerCase().replace(/\s+/g, ""));
  const col = (...kw: string[]): number => {
    for (const k of kw) {
      const kn = k.toLowerCase().replace(/\s+/g, "");
      const i = header.findIndex((h) => h.includes(kn));
      if (i >= 0) return i;
    }
    return -1;
  };

  const cCid = col("เลขบัตร", "เลข13", "เลข 13", "cid", "บัตรประชาชน");
  const cTreat = col("สถานะการติดตาม", "สถานะ");
  const cDetail = col("สถานะการรักษา", "รายละเอียด");
  const cProgram = col("hw/imc", "hw/mp", "โปรแกรม", "program");
  const cReferral = col("วิธีการมาบำบัด", "ส่งต่อ", "นำส่ง", "referral");
  const cTambon = col("ตำบล", "tambon");
  const cHN = col("hn");
  const cPrefix = col("คำนำ", "prefix");
  const cFirst = col("ชื่อ", "firstname", "fname");
  const cLast = col("สกุล", "นามสกุล", "lastname", "lname");
  const cAddr = col("ที่อยู่", "address", "บ้านเลขที่");
  const cAge = col("อายุ", "age");
  const cV2 = col("คะแนนv2", "v2");
  const cColor = col("สี", "color", "ระดับ");
  const cIsNew = col("ใหม่", "isnew");
  const cStartDate = col(
    "เริ่มมาจริง",
    "เริ่มลงบสต",
    "วันที่รับ",
    "บำบัด",
    "start",
  );

  // ── 3) อ่าน index พิกัดคู่ขนาน (cache 30 นาที) ──
  const coordIdx = await buildCoordIndexCached();

  // ── 4) วนแต่ละผู้ป่วย จับคู่พิกัด ──
  const points: DrugMapPoint[] = [];
  const unmatchedList: DrugMapUnmatched[] = [];
  const monthYm = new Map<string, string>(); // label → "YYYY-MM" (ค.ศ.) สำหรับจัดเรียง
  let total = 0;

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((c) => !toStr(c).trim())) continue;

    const firstName = cFirst >= 0 ? toStr(r[cFirst]) : "";
    const hn = cHN >= 0 ? toStr(r[cHN]) : "";
    if (!firstName && !hn) continue;
    total++;

    const prefix = cPrefix >= 0 ? toStr(r[cPrefix]) : "";
    const lastName = cLast >= 0 ? toStr(r[cLast]) : "";
    const fullName = `${prefix}${firstName} ${lastName}`.trim();
    const tambon = cTambon >= 0 ? toStr(r[cTambon]) : "";

    const id13 = cCid >= 0 ? normId(r[cCid]) : "";
    const coord = id13.length === 13 ? coordIdx.get(id13) : undefined;

    if (!coord) {
      unmatchedList.push({ hn, fullName, tambon });
      continue;
    }

    // เดือนที่รับบริการ: จาก "เริ่มมาจริง" → ถ้าว่าง สแกนทั้งแถวหาวันที่แรก
    let ym = cStartDate >= 0 ? ymFromDate(r[cStartDate]) : "";
    if (!ym) {
      for (let j = 0; j < r.length; j++) {
        const cand = ymFromDate(r[j]);
        if (cand && cand >= "2020-") {
          ym = cand;
          break;
        }
      }
    }
    const serviceMonth = ym ? monthLabelBE(ym) : "";
    if (serviceMonth) monthYm.set(serviceMonth, ym);

    points.push({
      id: points.length + 1,
      hn,
      prefix,
      firstName,
      lastName,
      fullName,
      address: cAddr >= 0 ? toStr(r[cAddr]) : "",
      tambon,
      color: cColor >= 0 ? normalizeColor(toStr(r[cColor])) : "ไม่ระบุ",
      treatStatus: cTreat >= 0 ? toStr(r[cTreat]) : "",
      detailStatus: cDetail >= 0 ? toStr(r[cDetail]) : "",
      program: cProgram >= 0 ? toStr(r[cProgram]) : "",
      referral: cReferral >= 0 ? toStr(r[cReferral]) : "",
      v2Score: cV2 >= 0 ? toNum(r[cV2]) : 0,
      age: cAge >= 0 ? toNum(r[cAge]) : 0,
      isNew:
        cIsNew >= 0
          ? ["ใหม่", "new", "y", "yes", "1", "true", "√"].includes(
              toStr(r[cIsNew]).toLowerCase(),
            )
          : false,
      serviceMonth,
      lat: coord.lat,
      lng: coord.lng,
      mapLink: coord.mapLink,
    });
  }

  return {
    updatedAt: new Date().toISOString(),
    total,
    matched: points.length,
    unmatched: unmatchedList.length,
    points,
    unmatchedList,
    filters: {
      tambon: uniq(points.map((p) => p.tambon)).sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
      color: uniq(points.map((p) => p.color)),
      treatStatus: uniq(points.map((p) => p.treatStatus)),
      program: uniq(points.map((p) => p.program)),
      referral: uniq(points.map((p) => p.referral)),
      month: [...monthYm.keys()].sort((a, b) =>
        (monthYm.get(b) ?? "").localeCompare(monthYm.get(a) ?? ""),
      ),
    },
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    if (!DRUG_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า DRUG_SPREADSHEET_ID ใน .env" },
        { status: 500 },
      );
    }

    const data = await cachedQuery(["drug-map"], buildDrugMapData, TTL_RESULT);

    return NextResponse.json(data);
  } catch (err) {
    return sheetsError(err, "DrugMap");
  }
}
