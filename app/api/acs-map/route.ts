// app/api/acs-map/route.ts
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  parseDate,
  sheetsError,
} from "@/lib/sheets";
import { cachedQuery } from "@/lib/cache";
import {
  getAcsAllRowsCached,
  type AcsPatientWithYear,
} from "@/lib/acsSheets.service";

// ─── Cache TTL ────────────────────────────────────────────────────────────────
// ทะเบียน ACS ทุกปี (rows) มี cache ของตัวเองแล้วใน getAcsAllRowsCached (10 นาที)
// ตรงนี้ cache เฉพาะผลรวมแผนที่ 15 นาที, ดัชนีพิกัด 30 นาที
const TTL_RESULT = 900;
const TTL_COORD_INDEX = 1800;

// ─── แหล่งข้อมูลพิกัด (ชุดเดียวกับ map อื่น ๆ ของระบบ) ─────────────────────────
const PIKAD_SPREADSHEET_ID = process.env.PIKAD_SPREADSHEET_ID!;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AcsMapPoint {
  id: number;
  hn: string;
  fullName: string;
  age: number | null;
  area: string; // พื้นที่/เขต
  yearBE: string; // ปี พ.ศ. (ตามชีต)
  dxGroup: string; // STEMI / NSTEMI / อื่นๆ / ไม่ระบุ
  diagnosis: string; // ค่าดิบจากชีต
  definiteDiagnosis: string;
  underlying: string; // โรคประจำตัว
  smoking: string;
  ems1669: string; // Yes / No / ไม่ระบุ
  ekgMin: number | null; // นาทีจนได้ EKG
  skGiven: string; // ได้ยา SK: Yes / No
  status: string; // Refer / Admit ...
  outcome: string;
  isDead: boolean;
  serviceDate: string; // YYYY-MM-DD ("" ถ้า parse ไม่ได้)
  serviceMonth: string; // "พ.ย. 2568"
  matchedBy: "cid" | "name"; // จับคู่พิกัดด้วยวิธีไหน (ไว้ debug คุณภาพข้อมูล)
  lat: number;
  lng: number;
  mapLink: string;
}

export interface AcsMapUnmatched {
  hn: string;
  fullName: string;
  area: string;
}

export interface AcsMapData {
  updatedAt: string;
  total: number; // ผู้ป่วย ACS ทั้งหมดในทะเบียน (ทุกปี)
  matched: number; // จับคู่พิกัดได้
  unmatched: number; // ไม่พบพิกัด
  points: AcsMapPoint[];
  unmatchedList: AcsMapUnmatched[];
  filters: {
    year: string[]; // ปี พ.ศ. ล่าสุดก่อน
    dxGroup: string[]; // STEMI / NSTEMI / อื่นๆ
    area: string[];
    ems: string[];
    sk: string[]; // ได้ยา SK
    status: string[];
    month: string[]; // เดือนที่รับบริการ (ล่าสุดก่อน)
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** เหลือเฉพาะตัวเลข (เลขบัตรมาได้ทั้งแบบมีขีด/ไม่มีขีด) */
function normId(v: unknown): string {
  return toStr(v).replace(/\D/g, "");
}

/** normalize HN: ตัดช่องว่าง + pad 0 ให้ครบ 9 หลัก (เฉพาะตัวเลขล้วน) */
function normHn(raw: string): string {
  const s = toStr(raw).trim();
  if (!s) return "";
  return /^\d+$/.test(s) ? s.padStart(9, "0") : s;
}

/** ตัดคำนำหน้า + ช่องว่าง เพื่อเทียบชื่อข้ามฟอร์แมต (แบบเดียวกับ homeward-map) */
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

/** จำแนกกลุ่มวินิจฉัย — ตรรกะเดียวกับ buildSummary ใน acsSheets.service */
function classifyDx(diagnosis: string): string {
  const d = diagnosis.toUpperCase();
  if (!d.trim()) return "ไม่ระบุ";
  if (d.includes("NSTEMI")) return "NSTEMI";
  if (d.includes("STEMI")) return "STEMI";
  return "อื่นๆ";
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

// ─── อ่านชีตพิกัด → 2 ดัชนี: เลข13หลัก และ ชื่อ(normalize) ────────────────────
// (โครง + cache key เดียวกับ map อื่น ๆ → แชร์ cache ก้อนเดียว)
type CoordEntry = { lat: number; lng: number; mapLink: string };

async function buildCoordIndexes(): Promise<{
  byCid: Map<string, CoordEntry>;
  byName: Map<string, CoordEntry>;
}> {
  const sheets = await getSheetClient();
  const first =
    (await getAllSheetTitles(sheets, PIKAD_SPREADSHEET_ID))[0] ?? "Sheet1";
  // A=ละติจูด/ลองจิจูด  B=ชื่อ-นามสกุล  C=เลข13หลัก  D=วันเกิด  E=ลิ้งพิกัด
  const raw = await getValues(sheets, PIKAD_SPREADSHEET_ID, `${first}!A2:E`);

  const byCid = new Map<string, CoordEntry>();
  const byName = new Map<string, CoordEntry>();
  for (const row of raw) {
    if (!row || row.length < 2) continue;
    const c = parseLatLng(toStr(row[0]));
    if (!c) continue;
    const entry: CoordEntry = {
      lat: c.lat,
      lng: c.lng,
      mapLink: toStr(row[4]),
    };

    const id = normId(row[2]);
    if (id.length === 13 && !byCid.has(id)) byCid.set(id, entry);

    const nk = nameKey(toStr(row[1]));
    if (nk && !byName.has(nk)) byName.set(nk, entry);
  }
  return { byCid, byName };
}

async function buildCoordIndexesCached() {
  const data = await cachedQuery<{
    cid: [string, CoordEntry][];
    name: [string, CoordEntry][];
  }>(
    ["pikad-coord-index-cid-name"],
    async () => {
      const { byCid, byName } = await buildCoordIndexes();
      return { cid: [...byCid.entries()], name: [...byName.entries()] };
    },
    TTL_COORD_INDEX,
  );
  return { byCid: new Map(data.cid), byName: new Map(data.name) };
}

// ─── HN → CID จาก HOSxP (ตาราง patient) ───────────────────────────────────────
interface HnCidRow extends RowDataPacket {
  hn: string;
  cid: string;
}

/** รับ HN ดิบจากชีต → Map<hnดิบ, cid13หลัก> (ยิงทั้งค่าดิบและค่า pad-0) */
async function getCidByHn(hns: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  const rawByNorm = new Map<string, string[]>();
  for (const raw of hns) {
    const r = toStr(raw).trim();
    if (!r) continue;
    const n = normHn(r);
    const arr = rawByNorm.get(n) ?? [];
    arr.push(r);
    rawByNorm.set(n, arr);
  }
  if (rawByNorm.size === 0) return result;

  const lookup = new Set<string>();
  for (const [n, raws] of rawByNorm) {
    lookup.add(n);
    raws.forEach((r) => lookup.add(r));
  }
  const hnList = [...lookup];

  // แบ่ง batch ละ 500 กัน IN clause ยาวเกิน
  const CHUNK = 500;
  const dbRows: HnCidRow[] = [];
  for (let i = 0; i < hnList.length; i += CHUNK) {
    const chunk = hnList.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const [rows] = await db.query<HnCidRow[]>(
      `SELECT p.hn AS hn, p.cid AS cid
       FROM patient p
       WHERE p.hn IN (${placeholders})
         AND p.cid IS NOT NULL AND p.cid <> ''`,
      chunk,
    );
    dbRows.push(...rows);
  }

  const cidByDbHn = new Map<string, string>();
  for (const r of dbRows) {
    const cid = normId(r.cid);
    if (cid.length !== 13) continue;
    const dbHn = toStr(r.hn).trim();
    cidByDbHn.set(dbHn, cid);
    cidByDbHn.set(normHn(dbHn), cid);
  }

  for (const [n, raws] of rawByNorm) {
    for (const raw of raws) {
      const cid = cidByDbHn.get(raw) ?? cidByDbHn.get(n);
      if (cid) result.set(raw, cid);
    }
  }
  return result;
}

// ─── สร้างข้อมูลแผนที่ (ถูกเรียกเฉพาะตอน cache miss) ──────────────────────────
async function buildAcsMapData(): Promise<AcsMapData> {
  // ── 1) ดึงคู่ขนาน: ทะเบียน ACS ทุกปี (cache 10 นาที) + ดัชนีพิกัด (cache 30 นาที) ──
  const [payload, coordIdx] = await Promise.all([
    getAcsAllRowsCached(),
    buildCoordIndexesCached(),
  ]);
  const rows: AcsPatientWithYear[] = payload.rows;

  // ── 2) HN → CID จาก HOSxP (ครั้งเดียวทั้งชุด) ──
  // ถ้า DB ล่ม ไม่ให้แผนที่พังทั้งหน้า — fallback จับคู่ด้วยชื่ออย่างเดียว
  let cidByHn = new Map<string, string>();
  try {
    cidByHn = await getCidByHn(rows.map((r) => r.hn));
  } catch (e) {
    console.error("[AcsMap] HN→CID lookup ล้มเหลว ใช้จับคู่ด้วยชื่อแทน:", e);
  }

  // ── 3) วนแต่ละราย จับคู่พิกัด: CID ก่อน → ชื่อสำรอง ──
  const points: AcsMapPoint[] = [];
  const unmatchedList: AcsMapUnmatched[] = [];
  const monthYm = new Map<string, string>(); // label → "YYYY-MM" (ค.ศ.) สำหรับจัดเรียง

  for (const r of rows) {
    let coord: CoordEntry | undefined;
    let matchedBy: "cid" | "name" = "cid";

    const cid = cidByHn.get(r.hn);
    if (cid) coord = coordIdx.byCid.get(cid);
    if (!coord) {
      const nk = nameKey(r.name);
      if (nk) {
        coord = coordIdx.byName.get(nk);
        if (coord) matchedBy = "name";
      }
    }

    if (!coord) {
      unmatchedList.push({
        hn: r.hn,
        fullName: r.name,
        area: r.area || "ไม่ระบุ",
      });
      continue;
    }

    // วันที่รับบริการในชีตเป็นข้อความ (อาจเป็น พ.ศ.) → parseDate จัดการให้
    const serviceDate = parseDate(r.serviceDate, { validate: true });
    const ym = /^\d{4}-\d{2}/.test(serviceDate) ? serviceDate.slice(0, 7) : "";
    const serviceMonth = ym ? monthLabelBE(ym) : "";
    if (serviceMonth) monthYm.set(serviceMonth, ym);

    const outcome = r.outcome.trim();
    const isDead = /dead|เสียชีวิต|death/i.test(
      `${outcome} ${r.status} ${r.note}`,
    );

    points.push({
      id: points.length + 1,
      hn: r.hn,
      fullName: r.name,
      age: r.age,
      area: r.area.trim() || "ไม่ระบุ",
      yearBE: r.yearBE,
      dxGroup: classifyDx(r.diagnosis),
      diagnosis: r.diagnosis,
      definiteDiagnosis: r.definiteDiagnosis,
      underlying: r.underlying,
      smoking: r.smoking,
      ems1669: /^y/i.test(r.ems1669)
        ? "Yes"
        : /^n/i.test(r.ems1669)
          ? "No"
          : "ไม่ระบุ",
      ekgMin: r.ekgMin,
      skGiven: /^y/i.test(r.skGiven) ? "Yes" : "No",
      status: r.status.trim() || "ไม่ระบุ",
      outcome: outcome || "ไม่ระบุ",
      isDead,
      serviceDate,
      serviceMonth,
      matchedBy,
      lat: coord.lat,
      lng: coord.lng,
      mapLink: coord.mapLink,
    });
  }

  const DX_ORDER = ["STEMI", "NSTEMI", "อื่นๆ", "ไม่ระบุ"];
  const dxInData = uniq(points.map((p) => p.dxGroup));

  return {
    updatedAt: new Date().toISOString(),
    total: rows.length,
    matched: points.length,
    unmatched: unmatchedList.length,
    points,
    unmatchedList,
    filters: {
      year: uniq(points.map((p) => p.yearBE)).sort((a, b) =>
        b.localeCompare(a),
      ),
      dxGroup: DX_ORDER.filter((d) => dxInData.includes(d)),
      area: uniq(points.map((p) => p.area)).sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
      ems: uniq(points.map((p) => p.ems1669)),
      sk: uniq(points.map((p) => p.skGiven)),
      status: uniq(points.map((p) => p.status)),
      month: [...monthYm.keys()].sort((a, b) =>
        (monthYm.get(b) ?? "").localeCompare(monthYm.get(a) ?? ""),
      ),
    },
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    if (!process.env.ACS_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า ACS_SPREADSHEET_ID ใน .env" },
        { status: 500 },
      );
    }
    if (!PIKAD_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า PIKAD_SPREADSHEET_ID ใน .env" },
        { status: 500 },
      );
    }

    const data = await cachedQuery(["acs-map"], buildAcsMapData, TTL_RESULT);

    return NextResponse.json(data);
  } catch (err) {
    return sheetsError(err, "AcsMap");
  }
}
