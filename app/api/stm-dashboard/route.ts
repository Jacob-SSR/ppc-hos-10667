// app/api/stm-dashboard/route.ts
import { NextResponse } from "next/server";
import { getSheetClient, getFirstSheetTitle } from "@/lib/sheets/client";
import { parseDate } from "@/lib/sheets/parseDate";
import { cachedQuery, invalidate } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHEET_ID = process.env.STM_SHEET_ID!;

// ─── Redis cache ───────────────────────────────────────────────────────────────
// cache "แถวดิบทั้งหมด" ก้อนเดียว → ทุก seg (all/walkin/nonwalkin) ใช้ cache ร่วมกัน
// TTL สั้นหน่อย (5 นาที) เพื่อยังใกล้เคียง realtime — ?refresh=1 บังคับดึงใหม่ได้
const CACHE_KEY = "stm-dashboard:rows";
const TTL = 300;

// ค่าใน PROJCODE (คอลัมน์ K) ที่ถือว่าเป็น WALKIN
const PROJ_WALKIN = "WALKIN";

// กลุ่มข้อมูลที่เลือกแสดง
export type StmSeg = "all" | "walkin" | "nonwalkin";
const SEG_LABEL: Record<StmSeg, string> = {
  all: "ทั้งหมด",
  walkin: "เฉพาะ WALKIN",
  nonwalkin: "เฉพาะ ไม่ WALKIN",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StmRow {
  rep: string;
  seq: number;
  tranId: string;
  hn: string;
  an: string;
  pid: string;
  ชื่อสกุล: string;
  วันเข้ารักษา: string;
  วันจำหน่าย: string;
  maininscl: string;
  projcode: string;
  เรียกเก็บ: number;
  พึงรับ: number; // col V (OP)
  hc: number; // col Y
  hcDrug: number; // col Z
  ae: number; // col AA
  aeDrug: number; // col AB
  inst: number; // col AC
  dmisCalc: number; // col AD
  dmisReal: number; // col AE
  dmisDrug: number; // col AF
  palliative: number; // col AG
  dmishd: number; // col AH
  pp: number; // col AI
  fs: number; // col AJ
  opbkk: number; // col AK
  ยอดชดเชย: number; // col AL (ยอดชดเชยทั้งสิ้น)
  แหล่งข้อมูล: string; // col AO
  seqNo: string; // col AP
}

export interface StmSubFundSummary {
  กองทุน: string;
  label: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
}

export interface StmRepSummary {
  rep: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
}

export interface StmMonthSummary {
  period: string; // "6810" (YYMM จาก REP)
  label: string; // "ต.ค. 68"
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
}

export interface StmDashboardData {
  updatedAt: string;
  source: "google-sheet";
  seg: StmSeg; // กลุ่มที่เลือก
  segLabel: string; // ป้ายกลุ่ม (ทั้งหมด/เฉพาะ WALKIN/เฉพาะ ไม่ WALKIN)
  totalRows: number;
  totalClaim: number; // เรียกเก็บรวม
  totalComp: number; // ยอดชดเชยทั้งสิ้น
  totalNoComp: number; // ส่วนต่างที่ยังไม่ชดเชย
  rows: StmRow[];
  byRep: StmRepSummary[];
  byMonth: StmMonthSummary[];
  bySubFund: StmSubFundSummary[];
  bySource: Record<string, number>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

// แปลงตัวเลข (รองรับ comma คั่นหลักพันกรณี sheet ส่งเป็น string)
function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

// แปลงค่าวันที่จาก sheet (serial number หรือ string) → "YYYY-MM-DD"
function toDate(v: unknown): string {
  if (v == null || v === "") return "";
  return parseDate(v) || toStr(v);
}

// ─── REP → เดือน (4 หลักแรกของ REP = YYMM พ.ศ.) ────────────────────────────────
const THAI_MONTHS_SHORT = [
  "",
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

// "681000028" → { period: "6810", label: "ต.ค. 68" }
function repPeriod(rep: string): { period: string; label: string } {
  const p = toStr(rep);
  const period = p.slice(0, 4); // YYMM
  const yy = period.slice(0, 2); // ปี พ.ศ. 2 หลัก
  const mm = parseInt(period.slice(2, 4), 10);
  const label =
    mm >= 1 && mm <= 12
      ? `${THAI_MONTHS_SHORT[mm]} ${yy}`
      : period || "ไม่ระบุ";
  return { period: period || "ไม่ระบุ", label };
}

// ─── Sub-fund labels ────────────────────────────────────────────────────────────
const SUB_FUNDS: { key: keyof StmRow; label: string }[] = [
  { key: "พึงรับ", label: "OP พึงรับ" },
  { key: "hc", label: "HC" },
  { key: "hcDrug", label: "HC Drug" },
  { key: "ae", label: "AE" },
  { key: "aeDrug", label: "AE Drug" },
  { key: "inst", label: "INST" },
  { key: "dmisCalc", label: "DMIS (คำนวณ)" },
  { key: "dmisReal", label: "DMIS (จ่ายจริง)" },
  { key: "dmisDrug", label: "DMIS Drug" },
  { key: "palliative", label: "Palliative Care" },
  { key: "dmishd", label: "DMISHD" },
  { key: "pp", label: "PP" },
  { key: "fs", label: "FS" },
  { key: "opbkk", label: "OPBKK" },
];

// ─── แปลง 1 แถวจาก sheet → StmRow (ลำดับคอลัมน์เหมือนไฟล์ STM_XXXXX_OPUCS) ──────
function rowToStm(r: unknown[]): StmRow {
  return {
    rep: toStr(r[0]),
    seq: toNum(r[1]),
    tranId: toStr(r[2]),
    hn: toStr(r[3]),
    an: toStr(r[4]),
    pid: toStr(r[5]),
    ชื่อสกุล: toStr(r[6]),
    วันเข้ารักษา: toDate(r[7]),
    วันจำหน่าย: toDate(r[8]),
    maininscl: toStr(r[9]),
    projcode: toStr(r[10]),
    เรียกเก็บ: toNum(r[11]), // L
    // ข้าม col 12-23 (M-X = กองทุน IP, AdjRW, ฯลฯ)
    พึงรับ: toNum(r[21]), // V = OP พึงรับ
    hc: toNum(r[24]), // Y
    hcDrug: toNum(r[25]), // Z
    ae: toNum(r[26]), // AA
    aeDrug: toNum(r[27]), // AB
    inst: toNum(r[28]), // AC
    dmisCalc: toNum(r[29]), // AD
    dmisReal: toNum(r[30]), // AE
    dmisDrug: toNum(r[31]), // AF
    palliative: toNum(r[32]), // AG
    dmishd: toNum(r[33]), // AH
    pp: toNum(r[34]), // AI
    fs: toNum(r[35]), // AJ
    opbkk: toNum(r[36]), // AK
    ยอดชดเชย: toNum(r[37]), // AL = ยอดชดเชยทั้งสิ้น
    // ข้าม col 38-39 (AM,AN = VA, COVID)
    แหล่งข้อมูล: toStr(r[40]), // AO
    seqNo: toStr(r[41]), // AP
  };
}

// ─── ดึงข้อมูลจาก Google Sheet + กรอง WALKIN ───────────────────────────────────
async function fetchAllRows(): Promise<StmRow[]> {
  const sheets = await getSheetClient(); // readonly scope
  const title = await getFirstSheetTitle(sheets, SHEET_ID);
  const safeTitle = title.replace(/'/g, "''");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${safeTitle}'!A:AP`,
    valueRenderOption: "UNFORMATTED_VALUE", // ได้ตัวเลขดิบ ไม่มี comma
    dateTimeRenderOption: "SERIAL_NUMBER", // วันที่เป็น serial → parseDate รองรับ
  });

  const raw = (res.data.values ?? []) as unknown[][];
  const rows: StmRow[] = [];

  for (const r of raw) {
    if (!Array.isArray(r)) continue;
    // ข้าม header (3 แถวบน) และแถวว่าง — แถวข้อมูลจริง REP เป็นตัวเลขล้วน
    if (!/^\d+$/.test(toStr(r[0]))) continue;
    rows.push(rowToStm(r));
  }

  return rows;
}

// แถวนี้เป็น WALKIN หรือไม่ (PROJCODE = WALKIN)
function isWalkin(r: StmRow): boolean {
  return r.projcode.toUpperCase() === PROJ_WALKIN;
}

// กรองตามกลุ่มที่เลือก
function filterBySeg(rows: StmRow[], seg: StmSeg): StmRow[] {
  if (seg === "walkin") return rows.filter(isWalkin);
  if (seg === "nonwalkin") return rows.filter((r) => !isWalkin(r));
  return rows; // all
}

// ─── Build dashboard ────────────────────────────────────────────────────────────
function buildDashboard(rows: StmRow[], seg: StmSeg): StmDashboardData {
  const totalClaim = rows.reduce((s, r) => s + r.เรียกเก็บ, 0);
  const totalComp = rows.reduce((s, r) => s + r.ยอดชดเชย, 0);
  const totalNoComp = Math.max(0, totalClaim - totalComp);

  // แยกตาม REP (งวดส่งข้อมูล)
  const repMap = new Map<string, StmRow[]>();
  for (const r of rows) {
    if (!repMap.has(r.rep)) repMap.set(r.rep, []);
    repMap.get(r.rep)!.push(r);
  }
  const byRep: StmRepSummary[] = Array.from(repMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rep, rr]) => {
      const claim = rr.reduce((s, r) => s + r.เรียกเก็บ, 0);
      const comp = rr.reduce((s, r) => s + r.ยอดชดเชย, 0);
      return {
        rep,
        จำนวน: rr.length,
        เรียกเก็บ: claim,
        ชดเชย: comp,
        ไม่ชดเชย: Math.max(0, claim - comp),
      };
    });

  // แยกตามเดือน (group 4 หลักแรกของ REP = YYMM)
  const monthMap = new Map<string, StmMonthSummary>();
  for (const r of rows) {
    const { period, label } = repPeriod(r.rep);
    let m = monthMap.get(period);
    if (!m) {
      m = { period, label, จำนวน: 0, เรียกเก็บ: 0, ชดเชย: 0, ไม่ชดเชย: 0 };
      monthMap.set(period, m);
    }
    m.จำนวน += 1;
    m.เรียกเก็บ += r.เรียกเก็บ;
    m.ชดเชย += r.ยอดชดเชย;
  }
  const byMonth: StmMonthSummary[] = Array.from(monthMap.values())
    .map((m) => ({ ...m, ไม่ชดเชย: Math.max(0, m.เรียกเก็บ - m.ชดเชย) }))
    .sort((a, b) => a.period.localeCompare(b.period)); // YYMM เรียงตามเวลา

  // แยกตามกองทุนย่อย
  const bySubFund: StmSubFundSummary[] = SUB_FUNDS.map(({ key, label }) => {
    const total = rows.reduce((s, r) => s + toNum(r[key as keyof StmRow]), 0);
    return {
      กองทุน: key as string,
      label,
      จำนวน: rows.filter((r) => toNum(r[key as keyof StmRow]) > 0).length,
      เรียกเก็บ: totalClaim,
      ชดเชย: total,
      ไม่ชดเชย: 0,
    };
  }).filter((s) => s.ชดเชย > 0);

  // แหล่งข้อมูล
  const bySource: Record<string, number> = {};
  for (const r of rows) {
    const src = r.แหล่งข้อมูล || "ไม่ระบุ";
    bySource[src] = (bySource[src] || 0) + 1;
  }

  return {
    updatedAt: new Date().toISOString(),
    source: "google-sheet",
    seg,
    segLabel: SEG_LABEL[seg],
    totalRows: rows.length,
    totalClaim,
    totalComp,
    totalNoComp,
    rows,
    byRep,
    byMonth,
    bySubFund,
    bySource,
  };
}

// ─── GET handler ────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const segParam = new URL(req.url).searchParams.get("seg");
    const seg: StmSeg =
      segParam === "all" || segParam === "nonwalkin" ? segParam : "walkin";

    // ?refresh=1 → ล้าง cache แล้วดึงจาก Sheets ใหม่ (ปุ่มรีเฟรชในหน้า dashboard)
    if (new URL(req.url).searchParams.get("refresh") === "1") {
      await invalidate(CACHE_KEY);
    }

    const all = await cachedQuery([CACHE_KEY], fetchAllRows, TTL);
    if (all.length === 0) {
      return NextResponse.json(
        {
          error:
            "ไม่พบข้อมูลใน Google Sheet — ตรวจสอบการแชร์สิทธิ์ให้ service account",
        },
        { status: 404 },
      );
    }

    const rows = filterBySeg(all, seg);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: `ไม่พบข้อมูลกลุ่ม "${SEG_LABEL[seg]}" ใน Google Sheet` },
        { status: 404 },
      );
    }
    return NextResponse.json(buildDashboard(rows, seg));
  } catch (err) {
    console.error("StmDashboard(sheets) error:", err);
    return NextResponse.json(
      {
        error: "ดึงข้อมูลจาก Google Sheet ไม่สำเร็จ: " + (err as Error).message,
      },
      { status: 500 },
    );
  }
}
