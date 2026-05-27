import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";

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

function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function parseDate(raw: unknown): string {
  if (!raw) return "";
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const ce = y > 2400 ? y - 543 : y;
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${ce}-${m}-${d}`;
  }
  return String(raw).slice(0, 10);
}

function normalizeHcode(raw: unknown): string {
  if (!raw) return "";
  const n = Math.round(Number(raw));
  if (isNaN(n)) return String(raw);
  return n < 10000 ? `0${n}` : String(n);
}

function parseXlsx(filePath: string): TbRow[] {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
  }) as unknown[][];

  // Row 0-3 = headers, data เริ่ม row 4
  const rows: TbRow[] = [];
  for (let i = 4; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    const repNo = r[1] ? String(r[1]).trim() : "";
    if (!repNo || repNo === "Filter" || repNo === "Fillter") continue;

    const hcodeKey = normalizeHcode(r[8]);
    const hcodeInfo = HCODE_MAP[hcodeKey];
    const หมายเหตุRaw = r[24] ? String(r[24]).trim() : "";
    const รายการขอเบิก = String(r[12] ?? "").trim();

    rows.push({
      repNo,
      transId: String(r[2] ?? ""),
      cid: String(r[5] ?? ""),
      ชื่อสกุล: String(r[6] ?? ""),
      สิทธิ: String(r[7] ?? ""),
      hcode: String(r[8] ?? ""),
      วันลงทะเบียน: parseDate(r[9]),
      วันรับบริการ: parseDate(r[10]),
      รายการขอเบิก,
      จำนวน: toNum(r[13]),
      ราคาต่อหน่วย: toNum(r[14]),
      ราคาเพดาน: toNum(r[15]),
      รวมขอเบิก: toNum(r[16]),
      ชดเชย: toNum(r[19]),
      ไม่ชดเชย: toNum(r[20]),
      จ่ายเพิ่ม: toNum(r[21]),
      เรียกคืน: toNum(r[22]),
      สถานะ: String(r[23] ?? "").trim(),
      หมายเหตุ: หมายเหตุRaw,
      หน่วยบริการ: hcodeInfo?.name ?? `หน่วยบริการ ${hcodeKey}`,
      hcodeKey,
    });
  }
  return rows;
}

function buildDashboard(rows: TbRow[]): TbDashboardData {
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
    totalRows: rows.length,
    totalClaim: rows.reduce((s, r) => s + r.รวมขอเบิก, 0),
    totalComp: rows.reduce((s, r) => s + r.ชดเชย, 0),
    totalNoComp: rows.reduce((s, r) => s + r.ไม่ชดเชย, 0),
    units,
    batches,
    remarkSummary,
  };
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "tb.xlsx");
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "ไม่พบไฟล์ data/tb.xlsx — กรุณาอัปโหลดข้อมูลก่อน" },
        { status: 404 },
      );
    }
    const rows = parseXlsx(filePath);
    const data = buildDashboard(rows);
    return NextResponse.json(data);
  } catch (err) {
    console.error("TbDashboard error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
