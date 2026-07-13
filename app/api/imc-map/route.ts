// app/api/imc-map/route.ts
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import {
  getSheetClient,
  getAllSheetTitles,
  getFirstSheetTitle,
  getValues,
  toStr,
  toNumOrNull,
  parseDate,
  sheetsError,
} from "@/lib/sheets";
import { cachedQuery } from "@/lib/cache";

// ─── Cache TTL ────────────────────────────────────────────────────────────────
// ทะเบียน IMC คีย์มือลง Sheets ไม่ realtime → ผลรวม 15 นาที, พิกัดบ้าน 30 นาที
const TTL_RESULT = 900;
const TTL_COORD_INDEX = 1800;

// ─── แหล่งข้อมูล ───────────────────────────────────────────────────────────────
// ทะเบียน IMC (ชุดเดียวกับ /api/imc-sheets)
const IMC_SPREADSHEET_ID = process.env.IMC_SPREADSHEET_ID!;
// ชีตพิกัดหลังคาเรือน (มี ละติจูด/ลองจิจูด + เลข 13 หลัก) — ชุดเดียวกับ drug-map
const PIKAD_SPREADSHEET_ID = process.env.PIKAD_SPREADSHEET_ID!;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ImcMapPoint {
  id: number;
  hn: string;
  an: string;
  fullName: string;
  age: number | null;
  tambon: string;
  fiscalYear: string; // ปีงบ พ.ศ. เช่น "2568"
  channel: string; // Referback / walkin
  diagnosis: string; // Dx. หลัก (Stroke / TBI / SCI / Fracture hip ...)
  complication: string;
  finalStatus: string; // status หลัง d/c (Improvement / Home / LTC / Death ...)
  biAdmit: number | null; // Barthel Index แรกรับ
  biBeforeDc: number | null; // BI ก่อนกลับบ้าน
  biAfterDc: number | null; // BI หลัง d/c (ติดตาม)
  admitDate: string; // YYYY-MM-DD
  dcDate: string;
  serviceMonth: string; // เดือนที่ admit เช่น "พ.ย. 2568"
  matchedBy: "cid" | "name"; // จับคู่พิกัดด้วยวิธีไหน (ไว้ debug คุณภาพข้อมูล)
  lat: number;
  lng: number;
  mapLink: string;
}

export interface ImcMapUnmatched {
  hn: string;
  fullName: string;
  tambon: string;
}

export interface ImcMapData {
  updatedAt: string;
  total: number; // ผู้ป่วย IMC ทั้งหมดในทะเบียน
  matched: number; // จับคู่พิกัดได้
  unmatched: number; // ไม่พบพิกัด
  points: ImcMapPoint[];
  unmatchedList: ImcMapUnmatched[];
  filters: {
    fiscalYear: string[]; // ปีงบล่าสุดก่อน
    diagnosis: string[];
    tambon: string[];
    channel: string[];
    status: string[];
    month: string[]; // เดือนที่ admit (ล่าสุดก่อน)
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** เหลือเฉพาะตัวเลข (เลขบัตรมาได้ทั้งแบบมีขีด/ไม่มีขีด) */
function normId(v: unknown): string {
  return toStr(v).replace(/\D/g, "");
}

/** normalize HN: ตัดช่องว่าง + pad 0 ให้ครบ 9 หลัก (เฉพาะตัวเลขล้วน) — แบบเดียวกับ sepsis.service */
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

/** normalize สถานะ d/c — ชุดเดียวกับ /api/imc-sheets ให้ยอดตรงกัน */
function normStatus(raw: string): string {
  const s = raw.trim();
  if (!s) return "ไม่ระบุ";
  if (s.toLowerCase().startsWith("improve"))
    return s.includes("จำหน่าย") ? "Improvement, จำหน่าย" : "Improvement";
  if (s === "Home") return "Home";
  if (s === "LTC") return "LTC";
  if (s === "Death") return "Death";
  if (s.includes("ย้าย")) return "ย้าย";
  return s;
}

// ── เดือนที่ admit (ป้ายภาษาไทย ปี พ.ศ. เต็ม เช่น "พ.ย. 2568") ──
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

/** เวอร์ชันมี cache — Map serialize ตรง ๆ ไม่ได้ ต้องแปลงเป็น entries ก่อน */
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

  // lookup จากผล DB: ทั้ง hn ตรงตัว และ hn แบบ normalize
  const cidByDbHn = new Map<string, string>();
  for (const r of dbRows) {
    const cid = normId(r.cid);
    if (cid.length !== 13) continue;
    const dbHn = toStr(r.hn).trim();
    cidByDbHn.set(dbHn, cid);
    cidByDbHn.set(normHn(dbHn), cid);
  }

  // map กลับไปหา hn ดิบจากชีต
  for (const [n, raws] of rawByNorm) {
    for (const raw of raws) {
      const cid = cidByDbHn.get(raw) ?? cidByDbHn.get(n);
      if (cid) result.set(raw, cid);
    }
  }
  return result;
}

// ─── อ่านทะเบียน IMC จากชีต (column map ชุดเดียวกับ /api/imc-sheets) ───────────
interface ImcSheetRow {
  hn: string;
  an: string;
  fullName: string;
  age: number | null;
  tambon: string;
  fiscalYear: string;
  channel: string;
  diagnosis: string;
  complication: string;
  finalStatus: string;
  biAdmit: number | null;
  biBeforeDc: number | null;
  biAfterDc: number | null;
  admitDate: string;
  dcDate: string;
}

async function readImcRows(): Promise<ImcSheetRow[]> {
  const sheets = await getSheetClient();
  const firstSheet = await getFirstSheetTitle(sheets, IMC_SPREADSHEET_ID);
  const raw = await getValues(sheets, IMC_SPREADSHEET_ID, `${firstSheet}!A:AZ`);

  if (raw.length < 2) {
    // throw เพื่อไม่ให้ error ถูก cache ค้าง 15 นาที
    throw new Error("ทะเบียน IMC ไม่มีข้อมูล");
  }

  const header = raw[0].map((h) => toStr(h));
  const find = (pred: (h: string) => boolean): number =>
    header.findIndex(pred);

  const cHN = find((h) => h.trim() === "HN");
  const cAN = find((h) => h.trim() === "AN");
  const cName = find((h) => h.includes("ชื่อ-สกุล"));
  const cAge = find((h) => h.trim() === "อายุ");
  const cTambon = find((h) => h.trim() === "ตำบล");
  const cFy = find((h) => h.includes("ปีงบ"));
  const cChannel = find((h) => h.includes("Referback"));
  const cDx = find((h) => h.startsWith("Dx"));
  const cComp = find((h) => h.includes("complication"));
  const cAdmit = find((h) => h.includes("Admit"));
  const cDc = find((h) => h.includes("D/C วันที่"));
  const cBiAdmit = find((h) => h.includes("BI แรกรับ"));
  const cBiDc = find((h) => h.includes("BI ก่อนกลับบ้าน"));
  const cBiAfter = find((h) => h.includes("BIหลัง"));
  const cStatus = find((h) => h.includes("status") && h.includes("d/c"));

  const get = (row: string[], idx: number): string =>
    idx >= 0 ? toStr(row[idx]) : "";

  const rows: ImcSheetRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every((c) => !toStr(c).trim())) continue;

    const fullName = get(row, cName).trim();
    const dx = get(row, cDx).trim();
    if (!fullName && !dx) continue;

    rows.push({
      hn: get(row, cHN).trim(),
      an: get(row, cAN).replace(/\.0$/, ""),
      fullName,
      age: toNumOrNull(get(row, cAge)),
      tambon: get(row, cTambon).trim() || "ไม่ระบุ",
      fiscalYear: get(row, cFy).replace(/\.0$/, ""),
      channel: get(row, cChannel).trim() || "ไม่ระบุ",
      diagnosis: dx || "ไม่ระบุ",
      complication: get(row, cComp).trim() || "No",
      finalStatus: cStatus >= 0 ? normStatus(get(row, cStatus)) : "ไม่ระบุ",
      biAdmit: toNumOrNull(get(row, cBiAdmit)),
      biBeforeDc: toNumOrNull(get(row, cBiDc)),
      biAfterDc: toNumOrNull(get(row, cBiAfter)),
      admitDate: parseDate(get(row, cAdmit), { validate: true }),
      dcDate: parseDate(get(row, cDc), { validate: true }),
    });
  }
  return rows;
}

// ─── สร้างข้อมูลแผนที่ (ถูกเรียกเฉพาะตอน cache miss) ──────────────────────────
async function buildImcMapData(): Promise<ImcMapData> {
  // ── 1) ดึงคู่ขนาน: ทะเบียน IMC (Sheet) + ดัชนีพิกัด (Sheet, cache 30 นาที) ──
  const [rows, coordIdx] = await Promise.all([
    readImcRows(),
    buildCoordIndexesCached(),
  ]);

  // ── 2) HN → CID จาก HOSxP (ครั้งเดียวทั้งชุด) ──
  // ถ้า DB ล่ม ไม่ให้แผนที่พังทั้งหน้า — fallback จับคู่ด้วยชื่ออย่างเดียว
  let cidByHn = new Map<string, string>();
  try {
    cidByHn = await getCidByHn(rows.map((r) => r.hn));
  } catch (e) {
    console.error("[ImcMap] HN→CID lookup ล้มเหลว ใช้จับคู่ด้วยชื่อแทน:", e);
  }

  // ── 3) วนแต่ละราย จับคู่พิกัด: CID ก่อน → ชื่อสำรอง ──
  const points: ImcMapPoint[] = [];
  const unmatchedList: ImcMapUnmatched[] = [];
  const monthYm = new Map<string, string>(); // label → "YYYY-MM" (ค.ศ.) สำหรับจัดเรียง

  for (const r of rows) {
    let coord: CoordEntry | undefined;
    let matchedBy: "cid" | "name" = "cid";

    const cid = cidByHn.get(r.hn);
    if (cid) coord = coordIdx.byCid.get(cid);
    if (!coord) {
      const nk = nameKey(r.fullName);
      if (nk) {
        coord = coordIdx.byName.get(nk);
        if (coord) matchedBy = "name";
      }
    }

    if (!coord) {
      unmatchedList.push({
        hn: r.hn,
        fullName: r.fullName,
        tambon: r.tambon,
      });
      continue;
    }

    const ym = /^\d{4}-\d{2}/.test(r.admitDate) ? r.admitDate.slice(0, 7) : "";
    const serviceMonth = ym ? monthLabelBE(ym) : "";
    if (serviceMonth) monthYm.set(serviceMonth, ym);

    points.push({
      id: points.length + 1,
      hn: r.hn,
      an: r.an,
      fullName: r.fullName,
      age: r.age,
      tambon: r.tambon,
      fiscalYear: r.fiscalYear,
      channel: r.channel,
      diagnosis: r.diagnosis,
      complication: r.complication,
      finalStatus: r.finalStatus,
      biAdmit: r.biAdmit,
      biBeforeDc: r.biBeforeDc,
      biAfterDc: r.biAfterDc,
      admitDate: r.admitDate,
      dcDate: r.dcDate,
      serviceMonth,
      matchedBy,
      lat: coord.lat,
      lng: coord.lng,
      mapLink: coord.mapLink,
    });
  }

  return {
    updatedAt: new Date().toISOString(),
    total: rows.length,
    matched: points.length,
    unmatched: unmatchedList.length,
    points,
    unmatchedList,
    filters: {
      fiscalYear: uniq(points.map((p) => p.fiscalYear)).sort((a, b) =>
        b.localeCompare(a),
      ),
      diagnosis: uniq(points.map((p) => p.diagnosis)).sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
      tambon: uniq(points.map((p) => p.tambon)).sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
      channel: uniq(points.map((p) => p.channel)),
      status: uniq(points.map((p) => p.finalStatus)),
      month: [...monthYm.keys()].sort((a, b) =>
        (monthYm.get(b) ?? "").localeCompare(monthYm.get(a) ?? ""),
      ),
    },
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    if (!IMC_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า IMC_SPREADSHEET_ID ใน .env" },
        { status: 500 },
      );
    }
    if (!PIKAD_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า PIKAD_SPREADSHEET_ID ใน .env" },
        { status: 500 },
      );
    }

    const data = await cachedQuery(["imc-map"], buildImcMapData, TTL_RESULT);

    return NextResponse.json(data);
  } catch (err) {
    return sheetsError(err, "ImcMap");
  }
}
