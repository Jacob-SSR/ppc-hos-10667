// app/api/accident-map/route.ts
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import {
  getSheetClient,
  getAllSheetTitles,
  getValues,
  toStr,
  sheetsError,
} from "@/lib/sheets";
import { cachedQuery } from "@/lib/cache";
import {
  getAccidentSheetsCached,
  type AccidentRow,
} from "@/lib/accidentSheets.service";

// ─── Cache TTL ────────────────────────────────────────────────────────────────
// ทะเบียนอุบัติเหตุ (rows) มี cache ของตัวเองแล้วใน getAccidentSheetsCached (10 นาที)
// ตรงนี้ cache เฉพาะผลรวมแผนที่ 15 นาที, ดัชนีพิกัด 30 นาที
const TTL_RESULT = 900;
const TTL_COORD_INDEX = 1800;

// ─── แหล่งข้อมูลพิกัด (ชุดเดียวกับ drug-map / imc-map / sepsis-map) ────────────
const PIKAD_SPREADSHEET_ID = process.env.PIKAD_SPREADSHEET_ID!;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AccidentMapPoint {
  id: number;
  hn: string;
  fullName: string; // จาก HOSxP patient (ชีตอุบัติเหตุไม่มีคอลัมน์ชื่อ)
  age: number;
  sex: string;
  address: string; // ที่อยู่ (จากชีต)
  tambon: string; // ตำบลที่เกิดเหตุ (ไม่ใช่ตำบลบ้าน)
  road: string; // ถนนที่เกิดเหตุ
  vehicle: string; // ประเภทพาหนะ
  severity: string; // ระดับความรุนแรง (triage)
  status: string; // Admit / Refer / D/C / Dead ...
  alcohol: string; // ดื่ม / ไม่ดื่ม
  protection: string; // สวมหมวกนิรภัย ฯลฯ
  diagnosis: string;
  mechanism: string;
  treatDate: string; // YYYY-MM-DD
  serviceMonth: string; // "พ.ย. 2568"
  matchedBy: "cid" | "name"; // จับคู่พิกัดด้วยวิธีไหน (ไว้ debug คุณภาพข้อมูล)
  lat: number;
  lng: number;
  mapLink: string;
}

export interface AccidentMapUnmatched {
  hn: string;
  fullName: string;
  tambon: string;
}

export interface AccidentMapData {
  updatedAt: string;
  total: number; // เคสอุบัติเหตุทั้งหมดในทะเบียน
  matched: number; // จับคู่พิกัดบ้านได้
  unmatched: number; // ไม่พบพิกัด
  points: AccidentMapPoint[];
  unmatchedList: AccidentMapUnmatched[];
  filters: {
    severity: string[];
    vehicle: string[];
    tambon: string[]; // ตำบลที่เกิดเหตุ
    status: string[];
    alcohol: string[];
    month: string[]; // เดือนที่มารับการรักษา (ล่าสุดก่อน)
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
// (โครง + cache key เดียวกับ /api/imc-map และ /api/sepsis-map → แชร์ cache ก้อนเดียว)
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

// ─── HN → {CID, ชื่อ-สกุล} จาก HOSxP (ตาราง patient) ──────────────────────────
// ชีตอุบัติเหตุไม่มีคอลัมน์ชื่อ → ต้องดึงชื่อจาก HOSxP มาแสดงด้วย
interface HnPatientRow extends RowDataPacket {
  hn: string;
  cid: string;
  fullName: string;
}
type PatientInfo = { cid: string; fullName: string };

/** รับ HN ดิบจากชีต → Map<hnดิบ, {cid, fullName}> (ยิงทั้งค่าดิบและค่า pad-0) */
async function getPatientByHn(hns: string[]): Promise<Map<string, PatientInfo>> {
  const result = new Map<string, PatientInfo>();

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
  const dbRows: HnPatientRow[] = [];
  for (let i = 0; i < hnList.length; i += CHUNK) {
    const chunk = hnList.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const [rows] = await db.query<HnPatientRow[]>(
      `SELECT p.hn AS hn,
              IFNULL(p.cid, '') AS cid,
              CONCAT(IFNULL(p.pname, ''), IFNULL(p.fname, ''), ' ', IFNULL(p.lname, '')) AS fullName
       FROM patient p
       WHERE p.hn IN (${placeholders})`,
      chunk,
    );
    dbRows.push(...rows);
  }

  const infoByDbHn = new Map<string, PatientInfo>();
  for (const r of dbRows) {
    const cid = normId(r.cid);
    const info: PatientInfo = {
      cid: cid.length === 13 ? cid : "",
      fullName: toStr(r.fullName).trim(),
    };
    if (!info.cid && !info.fullName) continue;
    const dbHn = toStr(r.hn).trim();
    infoByDbHn.set(dbHn, info);
    infoByDbHn.set(normHn(dbHn), info);
  }

  for (const [n, raws] of rawByNorm) {
    for (const raw of raws) {
      const info = infoByDbHn.get(raw) ?? infoByDbHn.get(n);
      if (info) result.set(raw, info);
    }
  }
  return result;
}

// ─── สร้างข้อมูลแผนที่ (ถูกเรียกเฉพาะตอน cache miss) ──────────────────────────
async function buildAccidentMapData(): Promise<AccidentMapData> {
  // ── 1) ดึงคู่ขนาน: ทะเบียนอุบัติเหตุ (cache 10 นาที) + ดัชนีพิกัด (cache 30 นาที) ──
  const [payload, coordIdx] = await Promise.all([
    getAccidentSheetsCached(),
    buildCoordIndexesCached(),
  ]);
  const rows: AccidentRow[] = payload.rows;

  // ── 2) HN → {CID, ชื่อ} จาก HOSxP (ครั้งเดียวทั้งชุด) ──
  // ชีตนี้ไม่มีคอลัมน์ชื่อ ถ้า DB ล่มจะจับคู่พิกัดไม่ได้เลย → คืน error ให้ retry
  const patientByHn = await getPatientByHn(rows.map((r) => r.hn));

  // ── 3) วนแต่ละเคส จับคู่พิกัดบ้าน: CID ก่อน → ชื่อสำรอง ──
  const points: AccidentMapPoint[] = [];
  const unmatchedList: AccidentMapUnmatched[] = [];
  const monthYm = new Map<string, string>(); // label → "YYYY-MM" (ค.ศ.) สำหรับจัดเรียง

  for (const r of rows) {
    const info = patientByHn.get(r.hn);
    const fullName = info?.fullName ?? "";

    let coord: CoordEntry | undefined;
    let matchedBy: "cid" | "name" = "cid";

    if (info?.cid) coord = coordIdx.byCid.get(info.cid);
    if (!coord && fullName) {
      const nk = nameKey(fullName);
      if (nk) {
        coord = coordIdx.byName.get(nk);
        if (coord) matchedBy = "name";
      }
    }

    if (!coord) {
      unmatchedList.push({
        hn: r.hn,
        fullName: fullName || "(ไม่พบชื่อใน HOSxP)",
        tambon: r.tambon || "ไม่ระบุ",
      });
      continue;
    }

    const ym = /^\d{4}-\d{2}/.test(r.treatDate) ? r.treatDate.slice(0, 7) : "";
    const serviceMonth = ym ? monthLabelBE(ym) : "";
    if (serviceMonth) monthYm.set(serviceMonth, ym);

    points.push({
      id: points.length + 1,
      hn: r.hn,
      fullName,
      age: r.age,
      sex: r.sex,
      address: r.address,
      tambon: r.tambon.trim() || "ไม่ระบุ",
      road: r.road,
      vehicle: r.vehicle.trim() || "ไม่ระบุ",
      severity: r.severity.trim() || "ไม่ระบุ",
      status: r.status.trim() || "ไม่ระบุ",
      alcohol: r.alcohol.trim() || "ไม่ระบุ",
      protection: r.protection,
      diagnosis: r.diagnosis,
      mechanism: r.mechanism,
      treatDate: /^\d{4}-\d{2}-\d{2}/.test(r.treatDate)
        ? r.treatDate.slice(0, 10)
        : "",
      serviceMonth,
      matchedBy,
      lat: coord.lat,
      lng: coord.lng,
      mapLink: coord.mapLink,
    });
  }

  // ลำดับ severity ตาม triage (หนัก → เบา)
  const SEV_ORDER = [
    "Dead",
    "Resuscitation",
    "Emergency",
    "Urgent",
    "semi - urgent",
    "non - urgent",
  ];
  const sevInData = uniq(points.map((p) => p.severity));
  const severity = [
    ...SEV_ORDER.filter((s) => sevInData.includes(s)),
    ...sevInData.filter((s) => !SEV_ORDER.includes(s)),
  ];

  return {
    updatedAt: new Date().toISOString(),
    total: rows.length,
    matched: points.length,
    unmatched: unmatchedList.length,
    points,
    unmatchedList,
    filters: {
      severity,
      vehicle: uniq(points.map((p) => p.vehicle)).sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
      tambon: uniq(points.map((p) => p.tambon)).sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
      status: uniq(points.map((p) => p.status)),
      alcohol: uniq(points.map((p) => p.alcohol)),
      month: [...monthYm.keys()].sort((a, b) =>
        (monthYm.get(b) ?? "").localeCompare(monthYm.get(a) ?? ""),
      ),
    },
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    if (!process.env.ACCIDENT_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า ACCIDENT_SPREADSHEET_ID ใน .env" },
        { status: 500 },
      );
    }
    if (!PIKAD_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า PIKAD_SPREADSHEET_ID ใน .env" },
        { status: 500 },
      );
    }

    const data = await cachedQuery(
      ["accident-map"],
      buildAccidentMapData,
      TTL_RESULT,
    );

    return NextResponse.json(data);
  } catch (err) {
    return sheetsError(err, "AccidentMap");
  }
}
