// app/api/anc-sheets/route.ts
// Dashboard งานเคลม ANC — ดึงข้อมูลจาก Google Sheets แบบ real-time
// โครงสร้างเดียวกับ app/api/accident-sheets/route.ts
import { NextResponse } from "next/server";
import {
  getSheetClient,
  getAllSheetTitles,
  getFirstSheetTitle,
  getValues,
  toStr,
  toNum,
  countBy,
  parseDate,
  monthLabelShort,
  sheetsError,
} from "@/lib/sheets";

// ใส่ ANC_SPREADSHEET_ID ใน .env ได้ (fallback = ชีตที่ส่งมา)
const SPREADSHEET_ID =
  process.env.ANC_SPREADSHEET_ID ??
  "1ZWBNkGX7zQSTaB16kKir0UwDa2GnoB2SfMcJ9A_tsqs";

// ชีตข้อมูลหลัก (master) — ถ้าไม่เจอจะ fallback ไปชีตแรก
const PREFERRED_SHEETS = ["ทั้งหมด"];

// อัตราคาดว่าจะได้รับชดเชยต่อราย (ค่าบริการดูแลฝากครรภ์ ADP 30011 = 360 บาท)
const EXPECTED_PER_CASE = 360;

const COLUMN_MAP: Record<string, keyof AncRow> = {
  เดือน: "month",
  ลำดับ: "no",
  VN: "vn",
  HN: "hn",
  วันที่รับบริการ: "serviceDate",
  ชดเชยจาก_Invoice: "compAmount",
  สถานะชดเชย: "compStatus",
  hipdata_code: "right",
  ชื่อสิทธิHOSxP: "rightName",
  สถานพยาบาลหลัก: "hmain",
  สถานพยาบาลรอง: "hsub",
  สิทธิการเงิน: "finRight",
  สถานะการมา: "visitStatus",
  ห้องตรวจ: "room",
  แผนก: "dept",
  แพทย์: "doctor",
  อาการสำคัญ: "cc",
  การวินิจฉัย: "diag",
  หัตถการ: "procedure",
  nhso_adp_code: "adpCode",
  รหัสรายการ: "itemCode",
  รายการ: "itemName",
  ค่ารักษา: "cost",
  ลูกหนี้: "debt",
  ชดเชยจาก_REP: "repComp",
  แหล่งข้อมูล: "source",
  กองทุนหลัก: "fundMain",
  กองทุนย่อย: "fundSub",
  สถานะเคลมFDH: "fdhStatus",
  ประสงค์เบิกชดเชย: "wantClaim",
  ยอดการโอนเงิน: "transferAmount",
  ที่อยู่: "address",
};

export interface AncRow {
  month: string;
  no: number;
  vn: string;
  hn: string;
  serviceDate: string;
  compAmount: number;
  compStatus: string; // OK = ชดเชยแล้ว, NO = ยังไม่ชดเชย
  right: string; // UCS / WEL / SSS / OFC
  rightName: string;
  hmain: string;
  hsub: string;
  finRight: string;
  visitStatus: string;
  room: string;
  dept: string;
  doctor: string;
  cc: string;
  diag: string;
  procedure: string;
  adpCode: string;
  itemCode: string;
  itemName: string;
  cost: number;
  debt: number;
  repComp: number;
  source: string;
  fundMain: string;
  fundSub: string;
  fdhStatus: string;
  wantClaim: string;
  transferAmount: number;
  address: string;
}

// ── เลือกชีตข้อมูลหลัก ──────────────────────────────────────────────────────
async function pickDataSheet(
  sheets: Awaited<ReturnType<typeof getSheetClient>>,
): Promise<string> {
  const titles = await getAllSheetTitles(sheets, SPREADSHEET_ID);
  const found = PREFERRED_SHEETS.find((t) => titles.includes(t));
  if (found) return found;
  return getFirstSheetTitle(sheets, SPREADSHEET_ID);
}

// ── ทำความสะอาดชื่อหน่วยบริการ ("10909#โรงพยาบาล...") ───────────────────────
function cleanFacility(raw: string): string {
  const s = toStr(raw);
  if (!s) return "ไม่ระบุ";
  const name = s.includes("#") ? s.split("#").slice(1).join("#") : s;
  return (
    name
      .replace(/โรงพยาบาลส่งเสริมสุขภาพตำบล(บ้าน)?/g, "รพ.สต.")
      .replace(/โรงพยาบาล/g, "รพ.")
      .trim() || "ไม่ระบุ"
  );
}

function parseRows(rawRows: string[][]): {
  rows: AncRow[];
  headers: string[];
} {
  if (rawRows.length < 2) return { rows: [], headers: [] };

  const header = rawRows[0].map((h) => toStr(h));
  const colIndex: Partial<Record<keyof AncRow, number>> = {};
  header.forEach((h, i) => {
    const key = COLUMN_MAP[h];
    if (key) colIndex[key] = i;
  });

  const get = (row: string[], key: keyof AncRow): string => {
    const idx = colIndex[key];
    return idx !== undefined ? toStr(row[idx]) : "";
  };

  const rows: AncRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every((c) => !c || !String(c).trim())) continue;

    const vn = get(row, "vn");
    const serviceRaw = get(row, "serviceDate");
    if (!vn && !serviceRaw) continue;

    rows.push({
      month: get(row, "month"),
      no: toNum(get(row, "no")) || i,
      vn,
      hn: get(row, "hn"),
      serviceDate: parseDate(serviceRaw) || serviceRaw,
      compAmount: toNum(get(row, "compAmount")),
      compStatus: get(row, "compStatus"),
      right: get(row, "right"),
      rightName: get(row, "rightName"),
      hmain: get(row, "hmain"),
      hsub: get(row, "hsub"),
      finRight: get(row, "finRight"),
      visitStatus: get(row, "visitStatus"),
      room: get(row, "room"),
      dept: get(row, "dept"),
      doctor: get(row, "doctor"),
      cc: get(row, "cc"),
      diag: get(row, "diag"),
      procedure: get(row, "procedure"),
      adpCode: get(row, "adpCode"),
      itemCode: get(row, "itemCode"),
      itemName: get(row, "itemName"),
      cost: toNum(get(row, "cost")),
      debt: toNum(get(row, "debt")),
      repComp: toNum(get(row, "repComp")),
      source: get(row, "source"),
      fundMain: get(row, "fundMain"),
      fundSub: get(row, "fundSub"),
      fdhStatus: get(row, "fdhStatus"),
      wantClaim: get(row, "wantClaim"),
      transferAmount: toNum(get(row, "transferAmount")),
      address: get(row, "address"),
    });
  }

  return { rows, headers: header };
}

function isOk(r: AncRow) {
  return r.compStatus.toUpperCase() === "OK";
}
function isNo(r: AncRow) {
  return r.compStatus.toUpperCase() === "NO";
}

function buildSummary(rows: AncRow[]) {
  const total = rows.length;
  const okRows = rows.filter(isOk);
  const noRows = rows.filter(isNo);

  const okCount = okRows.length;
  const noCount = noRows.length;

  const claimedAmount = okRows.reduce((s, r) => s + r.compAmount, 0); // ยอดชดเชยจริง
  const debtTotal = rows.reduce((s, r) => s + r.debt, 0); // มูลค่าเรียกเก็บ (ลูกหนี้)
  const expectedAmount = noCount * EXPECTED_PER_CASE; // คาดว่าจะได้รับชดเชย
  const compRate = total > 0 ? Math.round((okCount / total) * 1000) / 10 : 0;

  const uniquePatients = new Set(rows.map((r) => r.hn).filter(Boolean)).size;

  // ── รายเดือน (เรียงตามเวลา) ──
  const monthMap: Record<
    string,
    {
      label: string;
      total: number;
      ok: number;
      no: number;
      claimed: number;
      debt: number;
    }
  > = {};
  rows.forEach((r) => {
    const key = /^\d{4}-\d{2}/.test(r.serviceDate)
      ? r.serviceDate.slice(0, 7)
      : "ไม่ระบุ";
    const label =
      r.month?.trim() || (key !== "ไม่ระบุ" ? monthLabelShort(key) : "ไม่ระบุ");
    if (!monthMap[key])
      monthMap[key] = { label, total: 0, ok: 0, no: 0, claimed: 0, debt: 0 };
    const m = monthMap[key];
    m.total++;
    if (isOk(r)) {
      m.ok++;
      m.claimed += r.compAmount;
    }
    if (isNo(r)) m.no++;
    m.debt += r.debt;
  });
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ key, ...v }));

  // ── หน่วยบริการ (สถานพยาบาลรอง ทำความสะอาดชื่อ) ──
  const facilityMap: Record<string, number> = {};
  rows.forEach((r) => {
    const f = cleanFacility(r.hsub || r.hmain);
    facilityMap[f] = (facilityMap[f] || 0) + 1;
  });

  // ── สถานะเคลม FDH (label ไทย) ──
  const fdhMap: Record<string, number> = {};
  rows.forEach((r) => {
    const k = r.fdhStatus.trim() || "ไม่ระบุ";
    fdhMap[k] = (fdhMap[k] || 0) + 1;
  });

  return {
    total,
    okCount,
    noCount,
    uniquePatients,
    claimedAmount,
    debtTotal,
    expectedAmount,
    compRate,
    byMonth,
    byStatus: {
      ชดเชยแล้ว: okCount,
      ยังไม่ชดเชย: noCount,
    },
    byRight: countBy(rows, "right"),
    byDept: countBy(rows, "dept"),
    bySource: countBy(rows, "source"),
    byFdhStatus: fdhMap,
    byFacility: facilityMap,
  };
}

export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const sheets = await getSheetClient();
    const sheetName = await pickDataSheet(sheets);
    const raw = await getValues(sheets, SPREADSHEET_ID, `${sheetName}!A:BZ`);

    const { rows, headers } = parseRows(raw);
    const summary = buildSummary(rows);

    if (debug) {
      return NextResponse.json({
        sheetName,
        headers,
        totalRows: rows.length,
        sample: rows.slice(0, 5),
        summary,
      });
    }

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sheetName,
      rows,
      summary,
    });
  } catch (err) {
    return sheetsError(err, "AncSheets");
  }
}
