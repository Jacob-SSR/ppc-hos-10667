import { NextResponse } from "next/server";
import {
  getSheetClient,
  getFirstSheetTitle,
  getValues,
  toStr,
  toNum,
  parseDate,
  sheetsError,
} from "@/lib/sheets";

// ─── แหล่งข้อมูล ───────────────────────────────────────────────────────────────
const MINITHAN_SPREADSHEET_ID = process.env.MINITHAN_SPREADSHEET_ID!;
const PIKAD_SPREADSHEET_ID = process.env.PIKAD_SPREADSHEET_ID!;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MiniThanMapPoint {
  id: number;
  hn: string;
  prefix: string;
  firstName: string;
  lastName: string;
  fullName: string;
  address: string;
  tambon: string;
  color: string; // ระดับความรุนแรง (สี)
  treatStatus: string; // ติดตาม/บำบัด/จำหน่าย
  detailStatus: string; // treat ครบ/Metrix/Dropout ฯลฯ
  program: string; // HW/IMC/MP
  referral: string; // วิธีการมาบำบัด
  v2Score: number;
  age: number;
  isNew: boolean;
  serviceMonth: string; // เดือนที่รับบริการ (เริ่มมาจริง) เช่น "พ.ย. 2568"
  matchBy: "cid" | "name"; // วิธีจับคู่พิกัด
  lat: number;
  lng: number;
  mapLink: string;
}

export interface MiniThanMapUnmatched {
  hn: string;
  fullName: string;
  tambon: string;
}

export interface MiniThanMapData {
  updatedAt: string;
  total: number;
  matched: number;
  unmatched: number;
  points: MiniThanMapPoint[];
  unmatchedList: MiniThanMapUnmatched[];
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
function monthLabelBE(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  if (!y || isNaN(idx) || idx < 0 || idx > 11) return "";
  return `${THAI_M[idx]} ${parseInt(y) + 543}`;
}
function ymFromDate(v: unknown): string {
  const d = parseDate(v, { validate: true });
  return /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : "";
}

// ─── อ่านชีตพิกัด → index ทั้งแบบ CID และแบบชื่อ ─────────────────────────────
async function buildCoordIndexes(): Promise<{
  byCid: Map<string, { lat: number; lng: number; mapLink: string }>;
  byName: Map<string, { lat: number; lng: number; mapLink: string }>;
}> {
  const sheets = await getSheetClient();
  const first = await getFirstSheetTitle(sheets, PIKAD_SPREADSHEET_ID);
  // A=ละติจูด/ลองจิจูด  B=ชื่อ-นามสกุล  C=เลข13หลัก  D=วันเกิด  E=ลิ้งพิกัด
  const raw = await getValues(sheets, PIKAD_SPREADSHEET_ID, `${first}!A2:E`);

  const byCid = new Map<
    string,
    { lat: number; lng: number; mapLink: string }
  >();
  const byName = new Map<
    string,
    { lat: number; lng: number; mapLink: string }
  >();
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

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const sheets = await getSheetClient();
    const first = await getFirstSheetTitle(sheets, MINITHAN_SPREADSHEET_ID);
    const raw = await getValues(
      sheets,
      MINITHAN_SPREADSHEET_ID,
      `${first}!A:AJ`,
    );

    if (raw.length < 2) {
      return NextResponse.json(
        { error: "ชีตมินิธัญญารักษ์ไม่มีข้อมูล" },
        { status: 500 },
      );
    }

    // ── หา index คอลัมน์ (fuzzy + fallback offset ตาม template บสต.) ──
    const header = raw[0].map((h) => toStr(h));
    const col = (kws: string[], fallback: number): number => {
      for (const kw of kws) {
        const i = header.findIndex((h) =>
          h.toLowerCase().includes(kw.toLowerCase()),
        );
        if (i >= 0) return i;
      }
      return fallback;
    };
    // strict = ไม่มี fallback (คืน -1 ถ้าไม่พบ) กันดึงคอลัมน์ผิด
    const colStrict = (kws: string[]): number => col(kws, -1);

    const cTreat = col(["สถานะ"], 2);
    const cDetail = col(["สถานะการรักษาปัจจุบัน"], 3);
    const cProgram = col(["hw/imc/mp", "hw/imc", "mp"], 4);
    const cReferral = col(["วิธีการมาบำบัด"], 5);
    const cTambon = col(["ตำบล"], 6);
    const cHN = col(["hn"], 7);
    const cCid = col(["เลขบัตร", "เลข13", "เลข 13", "บัตรประชาชน"], 9);
    const cPrefix = col(["คำนำหน้า"], 12);
    const cFirst = col(["ชื่อ"], 13);
    const cLast = col(["สกุล"], 14);
    const cAddr = colStrict(["ที่อยู่", "บ้านเลขที่"]);
    const cAge = col(["อายุ"], 16);
    const cV2 = col(["คะแนน v2", "v2"], 17);
    const cColor = col(["สี"], 18);
    const cIsNew = col(["ใหม่"], 19);
    const cStartDate = col(["เริ่มมาจริง", "เริ่มลงบสต"], 35);

    const { byCid, byName } = await buildCoordIndexes();

    const points: MiniThanMapPoint[] = [];
    const unmatchedList: MiniThanMapUnmatched[] = [];
    const monthYm = new Map<string, string>();
    let total = 0;

    for (let i = 1; i < raw.length; i++) {
      const r = raw[i];
      if (!r || r.every((c) => !toStr(c).trim())) continue;

      const program = toStr(r[cProgram]);
      if (!program.toUpperCase().includes("IMC")) continue; // เฉพาะมินิธัญญารักษ์ (โปรแกรม IMC)

      const firstName = toStr(r[cFirst]);
      const hn = toStr(r[cHN]);
      if (!firstName && !hn) continue;
      total++;

      const prefix = toStr(r[cPrefix]);
      const lastName = toStr(r[cLast]);
      const fullName = `${prefix}${firstName} ${lastName}`.trim();
      const tambon = toStr(r[cTambon]);

      // จับคู่พิกัด: CID ก่อน แล้วค่อย fallback เป็นชื่อ
      const id13 = normId(r[cCid]);
      let coord = id13.length === 13 ? byCid.get(id13) : undefined;
      let matchBy: "cid" | "name" = "cid";
      if (!coord) {
        const nk = nameKey(`${prefix}${firstName} ${lastName}`);
        coord = byName.get(nk);
        matchBy = "name";
      }

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
        color: normalizeColor(toStr(r[cColor])),
        treatStatus: toStr(r[cTreat]),
        detailStatus: toStr(r[cDetail]),
        program,
        referral: toStr(r[cReferral]),
        v2Score: toNum(r[cV2]),
        age: toNum(r[cAge]),
        isNew: toStr(r[cIsNew]).trim() !== "",
        serviceMonth,
        matchBy,
        lat: coord.lat,
        lng: coord.lng,
        mapLink: coord.mapLink,
      });
    }

    const result: MiniThanMapData = {
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

    return NextResponse.json(result);
  } catch (err) {
    return sheetsError(err, "MiniThanMap");
  }
}
