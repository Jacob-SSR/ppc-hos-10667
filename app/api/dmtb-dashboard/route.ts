// app/api/dmtb-dashboard/route.ts
import { NextResponse } from "next/server";
import {
  getSheetClient,
  getFirstSheetTitle,
  getValues,
  toStr,
  parseDate,
  sheetsError,
} from "@/lib/sheets";
import { cachedQuery } from "@/lib/cache";

const SPREADSHEET_ID = process.env.DMTB_SPREADSHEET_ID!;

const TTL_SECONDS = 900;
// ── ตำแหน่งคอลัมน์ (index เริ่ม 0) ตาม layout จริงของ DMTB ─────────────────────
const C = {
  repNo: 1,
  transId: 2,
  cid: 5, // VCTID,NAPNumber,PID
  name: 6, // ชื่อ-สกุล
  right: 7, // สิทธิการรักษาพยาบาล
  hcode: 8,
  regDate: 9, // วันที่ลงทะเบียน
  servDate: 10, // วันที่เข้ารักษา/วันที่รับบริการ
  item: 12, // รายการประเภทที่ขอเบิก
  qty: 13, // จำนวน
  unitPrice: 14, // ราคาต่อหน่วย
  ceiling: 15, // ราคาเพดาน
  total: 16, // รวมเงินที่ขอเบิก
  comp: 19, // ชดเชย (หัวย่อยแถวล่าง)
  noComp: 20, // ไม่ชดเชย
  extra: 21, // จ่ายเพิ่ม
  recall: 22, // เรียกคืน
  status: 23, // สถานะ
  remark: 24, // หมายเหตุ
} as const;

export interface TbRow {
  repNo: string;
  transId: string;
  cid: string;
  ชื่อสกุล: string;
  สิทธิ: string;
  hcode: string;
  วันลงทะเบียน: string;
  วันรับบริการ: string;
  รายการขอเบิก: string;
  จำนวน: number;
  ราคาต่อหน่วย: number;
  ราคาเพดาน: number;
  รวมขอเบิก: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  จ่ายเพิ่ม: number;
  เรียกคืน: number;
  สถานะ: string;
  หมายเหตุ: string;
  หน่วยบริการ: string;
  hcodeKey: string;
}

export interface TbItemSummary {
  รายการขอเบิก: string;
  รายการสั้น: string;
  สถานะ: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  หมายเหตุ: Record<string, number>;
}

export interface TbUnitSummary {
  หน่วยบริการ: string;
  hcodeKey: string;
  isHospital: boolean;
  รายการทั้งหมด: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  อัตราชดเชย: number;
  items: TbItemSummary[];
}

export interface TbBatchSummary {
  repNo: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
}

export interface TbDashboardData {
  updatedAt: string;
  sheetName: string;
  totalRows: number;
  totalClaim: number;
  totalComp: number;
  totalNoComp: number;
  units: TbUnitSummary[];
  batches: TbBatchSummary[];
  remarkSummary: {
    รหัส: string;
    หน่วยบริการ: string;
    จำนวน: number;
    เรียกเก็บ: number;
  }[];
}

const HCODE_MAP: Record<string, { name: string; isHospital: boolean }> = {
  "10909": { name: "โรงพยาบาลพลับพลาชัย", isHospital: true },
};

const SHORT_LABELS: Record<string, string> = {
  "ค่าบริการถ่ายภาพรังสีทรวงอก CXR เพื่อวินิจฉัยวัณโรคในกลุ่มเสี่ยงสูง":
    "CXR คัดกรอง TB",
  "ค่าบริการถ่ายภาพรังสีทรวงอก CXR เพื่อติดตามการรักษา": "CXR ติดตาม",
  "ค่าบริการตรวจเสมหะ AFB เพื่อติดตามการรักษา": "AFB เสมหะ",
  ค่าบริการดูแลรักษาผู้ป่วยวัณโรคที่มารับการรักษาและติดตาม: "ดูแลรักษา TB",
};

// ── helpers ───────────────────────────────────────────────────────────────────
// แปลงข้อความตัวเลข (อาจมี comma หลักพัน หรือ .0 ต่อท้าย) → number
function money(v: unknown): number {
  const n = Number(
    String(v ?? "")
      .replace(/,/g, "")
      .trim(),
  );
  return isNaN(n) ? 0 : n;
}

function normalizeHcode(raw: unknown): string {
  const s = toStr(raw);
  if (!s) return "";
  const n = Math.round(Number(s));
  if (isNaN(n)) return s;
  return n < 10000 ? `0${n}` : String(n);
}

// ── parse จาก Google Sheets values (string[][]) ─────────────────────────────────
function parseSheet(raw: string[][]): TbRow[] {
  const get = (row: string[], idx: number) => toStr(row[idx]);
  const rows: TbRow[] = [];

  for (const r of raw) {
    if (!r) continue;

    const repNo = get(r, C.repNo);
    // ข้ามหัวตาราง (2 แถว), แถวว่าง และแถว Filter
    if (
      !repNo ||
      repNo === "REP No." ||
      repNo === "Filter" ||
      repNo === "Fillter"
    )
      continue;

    const hcodeRaw = get(r, C.hcode);
    const hcodeKey = normalizeHcode(hcodeRaw);
    const hcodeInfo = HCODE_MAP[hcodeKey];

    const regRaw = get(r, C.regDate);
    const servRaw = get(r, C.servDate);

    rows.push({
      repNo,
      transId: get(r, C.transId),
      cid: get(r, C.cid),
      ชื่อสกุล: get(r, C.name),
      สิทธิ: get(r, C.right),
      hcode: hcodeRaw,
      วันลงทะเบียน: parseDate(regRaw) || regRaw,
      วันรับบริการ: parseDate(servRaw) || servRaw,
      รายการขอเบิก: get(r, C.item),
      จำนวน: money(get(r, C.qty)),
      ราคาต่อหน่วย: money(get(r, C.unitPrice)),
      ราคาเพดาน: money(get(r, C.ceiling)),
      รวมขอเบิก: money(get(r, C.total)),
      ชดเชย: money(get(r, C.comp)),
      ไม่ชดเชย: money(get(r, C.noComp)),
      จ่ายเพิ่ม: money(get(r, C.extra)),
      เรียกคืน: money(get(r, C.recall)),
      สถานะ: get(r, C.status),
      หมายเหตุ: get(r, C.remark),
      หน่วยบริการ: hcodeInfo?.name ?? `หน่วยบริการ ${hcodeKey}`,
      hcodeKey,
    });
  }
  return rows;
}

// ── build dashboard ─────────────────────────────────────────────────────────────
function buildDashboard(rows: TbRow[], sheetName: string): TbDashboardData {
  // group by unit → item → status
  const unitMap = new Map<
    string,
    Map<string, Map<string, { rows: TbRow[] }>>
  >();

  for (const r of rows) {
    if (!unitMap.has(r.hcodeKey)) unitMap.set(r.hcodeKey, new Map());
    const itemMap = unitMap.get(r.hcodeKey)!;
    const itemKey = r.รายการขอเบิก;
    if (!itemMap.has(itemKey)) itemMap.set(itemKey, new Map());
    const statusMap = itemMap.get(itemKey)!;
    if (!statusMap.has(r.สถานะ)) statusMap.set(r.สถานะ, { rows: [] });
    statusMap.get(r.สถานะ)!.rows.push(r);
  }

  const units: TbUnitSummary[] = [];
  const sortedKeys = Array.from(unitMap.keys()).sort((a, b) => {
    const aH = HCODE_MAP[a]?.isHospital ? 0 : 1;
    const bH = HCODE_MAP[b]?.isHospital ? 0 : 1;
    return aH - bH || a.localeCompare(b);
  });

  for (const hcodeKey of sortedKeys) {
    const itemMap = unitMap.get(hcodeKey)!;
    const hcodeInfo = HCODE_MAP[hcodeKey];
    const items: TbItemSummary[] = [];

    for (const [itemKey, statusMap] of itemMap) {
      for (const [status, { rows: sr }] of statusMap) {
        const remarkCount: Record<string, number> = {};
        for (const r of sr) {
          if (r.หมายเหตุ) {
            const code = r.หมายเหตุ.split("##")[0];
            remarkCount[code] = (remarkCount[code] || 0) + 1;
          }
        }
        items.push({
          รายการขอเบิก: itemKey,
          รายการสั้น: SHORT_LABELS[itemKey] ?? itemKey,
          สถานะ: status,
          จำนวน: sr.length,
          เรียกเก็บ: sr.reduce((s, r) => s + r.รวมขอเบิก, 0),
          ชดเชย: sr.reduce((s, r) => s + r.ชดเชย, 0),
          ไม่ชดเชย: sr.reduce((s, r) => s + r.ไม่ชดเชย, 0),
          หมายเหตุ: remarkCount,
        });
      }
    }

    const totalClaim = items.reduce((s, i) => s + i.เรียกเก็บ, 0);
    const totalComp = items.reduce((s, i) => s + i.ชดเชย, 0);
    const totalNoComp = items.reduce((s, i) => s + i.ไม่ชดเชย, 0);
    const totalRows = items.reduce((s, i) => s + i.จำนวน, 0);

    units.push({
      หน่วยบริการ: hcodeInfo?.name ?? `หน่วยบริการ ${hcodeKey}`,
      hcodeKey,
      isHospital: hcodeInfo?.isHospital ?? false,
      รายการทั้งหมด: totalRows,
      เรียกเก็บ: totalClaim,
      ชดเชย: totalComp,
      ไม่ชดเชย: totalNoComp,
      อัตราชดเชย:
        totalClaim > 0 ? Math.round((totalComp / totalClaim) * 1000) / 10 : 0,
      items,
    });
  }

  // batch summary by REP No.
  const batchMap = new Map<string, TbRow[]>();
  for (const r of rows) {
    if (!batchMap.has(r.repNo)) batchMap.set(r.repNo, []);
    batchMap.get(r.repNo)!.push(r);
  }

  const batches: TbBatchSummary[] = Array.from(batchMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([repNo, bRows]) => ({
      repNo,
      จำนวน: bRows.length,
      เรียกเก็บ: bRows.reduce((s, r) => s + r.รวมขอเบิก, 0),
      ชดเชย: bRows.reduce((s, r) => s + r.ชดเชย, 0),
      ไม่ชดเชย: bRows.reduce((s, r) => s + r.ไม่ชดเชย, 0),
    }));

  // remark summary
  const remarkMap = new Map<
    string,
    { unit: string; count: number; claim: number }
  >();
  for (const r of rows) {
    if (!r.หมายเหตุ) continue;
    const code = r.หมายเหตุ.split("##")[0];
    const key = `${code}|||${r.หน่วยบริการ}`;
    if (!remarkMap.has(key))
      remarkMap.set(key, { unit: r.หน่วยบริการ, count: 0, claim: 0 });
    const e = remarkMap.get(key)!;
    e.count++;
    e.claim += r.รวมขอเบิก;
  }

  const remarkSummary = Array.from(remarkMap.entries())
    .map(([key, v]) => ({
      รหัส: key.split("|||")[0],
      หน่วยบริการ: v.unit,
      จำนวน: v.count,
      เรียกเก็บ: v.claim,
    }))
    .sort((a, b) => b.จำนวน - a.จำนวน);

  return {
    updatedAt: new Date().toISOString(),
    sheetName,
    totalRows: rows.length,
    totalClaim: rows.reduce((s, r) => s + r.รวมขอเบิก, 0),
    totalComp: rows.reduce((s, r) => s + r.ชดเชย, 0),
    totalNoComp: rows.reduce((s, r) => s + r.ไม่ชดเชย, 0),
    units,
    batches,
    remarkSummary,
  };
}

export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    // โหมด debug → อ่านสดเสมอ ไม่ผ่าน cache (ไว้เช็ค layout ชีตจริง)
    if (debug) {
      const sheets = await getSheetClient();
      const firstSheet = await getFirstSheetTitle(sheets, SPREADSHEET_ID);
      const raw = await getValues(sheets, SPREADSHEET_ID, `${firstSheet}!A:AC`);
      const rows = parseSheet(raw);
      return NextResponse.json({
        sheetName: firstSheet,
        headerRow0: raw[0] ?? [],
        headerRow1: raw[1] ?? [],
        totalRows: rows.length,
        firstRows: rows.slice(0, 3),
      });
    }

    const data = await cachedQuery(
      ["dmtb-dashboard"],
      async () => {
        const sheets = await getSheetClient();
        const firstSheet = await getFirstSheetTitle(sheets, SPREADSHEET_ID);
        const raw = await getValues(
          sheets,
          SPREADSHEET_ID,
          `${firstSheet}!A:AC`,
        );
        return buildDashboard(parseSheet(raw), firstSheet);
      },
      TTL_SECONDS,
    );

    return NextResponse.json(data);
  } catch (err) {
    return sheetsError(err, "DmtbDashboard");
  }
}
