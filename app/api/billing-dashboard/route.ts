import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { BillingUnitSummary, BillingItemSummary, BillingDashboardData } from "@/types/allTypes";
export type { BillingUnitSummary, BillingItemSummary, BillingDashboardData };

export interface BillingRow {
  repNo: string;
  transId: string;
  cid: string;
  ชื่อสกุล: string;
  สิทธิ: string;
  hcode: string;
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




const HCODE_MAP: Record<string, { name: string; isHospital: boolean }> = {
  "10909": { name: "โรงพยาบาลพลับพลาชัย", isHospital: true },
  "03044": { name: "รพ.สต.บ้านจันดุม ", isHospital: false },
  "03045": { name: "รพ.สต.บ้านโคกเจริญ ", isHospital: false },
  "03046": { name: "รพ.สต.บ้านโคกขมิ้น ", isHospital: false },
  "03047": { name: "รพ.สต.ตาพระ", isHospital: false },
  "03048": { name: "รพ.สต.บ้านป่าชัน", isHospital: false },
  "03049": { name: "รพ.สต.สำโรง", isHospital: false },
};

const SHORT_LABELS: Record<string, string> = {
  "บริการฉีดวัคซีนพื้นฐานตามกาหนดการให้วัคซีนตามแผนงานสร้างเสริมภูมิคุ้มกันโรค (EPI) ของกระทรวงสาธารณสุข":
    "วัคซีน EPI",
  "บริการฉีดวัคซีนคอตีบ-บาดทะยัก (dT) ในผู้ใหญ่": "วัคซีน dT",
  "บริการควบคุมป้องกันและรักษาผู้ป่วยเบาหวาน หรือความดันโลหิตสูง": "ควบคุม DM/HT",
  "บริการผู้ป่วยเบาหวานชนิดที่ 2": "เบาหวาน T2",
  "บริการโรคความดันโลหิตสูง": "ความดันโลหิตสูง",
};

function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function extractHcodeKey(s: unknown): string {
  if (!s) return "";
  return String(s).split(" ")[0].trim();
}

function parseXlsx(filePath: string): BillingRow[] {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];

  // Row 0 = header, rows 1-2 = sub-headers/empty, row 3 = "Filter", data starts row 4
  const rows: BillingRow[] = [];
  for (let i = 4; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    if (!r[1] || String(r[1]).trim() === "" || String(r[1]).trim() === "Filter") continue;

    const hcodeKey = extractHcodeKey(r[25]);
    const hcodeInfo = HCODE_MAP[hcodeKey];
    const หมายเหตุRaw = r[24] ? String(r[24]).trim() : "";
    let dateStr = "";
    const rawDate = r[10];
    if (rawDate instanceof Date) {
      dateStr = rawDate.toISOString().slice(0, 10);
    } else if (rawDate) {
      // Excel serial or thai date string
      dateStr = String(rawDate).slice(0, 10);
    }

    rows.push({
      repNo: String(r[1] ?? ""),
      transId: String(r[2] ?? ""),
      cid: String(r[5] ?? ""),
      ชื่อสกุล: String(r[6] ?? ""),
      สิทธิ: String(r[7] ?? ""),
      hcode: String(r[8] ?? ""),
      วันรับบริการ: dateStr,
      รายการขอเบิก: String(r[12] ?? ""),
      จำนวน: toNum(r[13]),
      ราคาต่อหน่วย: toNum(r[14]),
      ราคาเพดาน: toNum(r[15]),
      รวมขอเบิก: toNum(r[16]),
      ชดเชย: toNum(r[19]),
      ไม่ชดเชย: toNum(r[20]),
      จ่ายเพิ่ม: toNum(r[21]),
      เรียกคืน: toNum(r[22]),
      สถานะ: String(r[23] ?? ""),
      หมายเหตุ: หมายเหตุRaw,
      หน่วยบริการ: hcodeInfo?.name ?? `หน่วยบริการ ${hcodeKey}`,
      hcodeKey,
    });
  }
  return rows;
}

function buildDashboard(rows: BillingRow[]): BillingDashboardData {
  // group by unit → item → status
  const unitMap = new Map<string, Map<string, Map<string, { rows: BillingRow[] }>>>();

  for (const r of rows) {
    if (!unitMap.has(r.hcodeKey)) unitMap.set(r.hcodeKey, new Map());
    const itemMap = unitMap.get(r.hcodeKey)!;
    const itemKey = r.รายการขอเบิก;
    if (!itemMap.has(itemKey)) itemMap.set(itemKey, new Map());
    const statusMap = itemMap.get(itemKey)!;
    if (!statusMap.has(r.สถานะ)) statusMap.set(r.สถานะ, { rows: [] });
    statusMap.get(r.สถานะ)!.rows.push(r);
  }

  const units: BillingUnitSummary[] = [];
  // Sort: hospital first, then รพสต
  const sortedKeys = Array.from(unitMap.keys()).sort((a, b) => {
    const aH = HCODE_MAP[a]?.isHospital ? 0 : 1;
    const bH = HCODE_MAP[b]?.isHospital ? 0 : 1;
    return aH - bH || a.localeCompare(b);
  });

  for (const hcodeKey of sortedKeys) {
    const itemMap = unitMap.get(hcodeKey)!;
    const hcodeInfo = HCODE_MAP[hcodeKey];
    const items: BillingItemSummary[] = [];

    for (const [itemKey, statusMap] of itemMap) {
      for (const [status, { rows: sr }] of statusMap) {
        const remarkCount: Record<string, number> = {};
        for (const r of sr) {
          if (r.หมายเหตุ) remarkCount[r.หมายเหตุ] = (remarkCount[r.หมายเหตุ] || 0) + 1;
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
      อัตราชดเชย: totalClaim > 0 ? Math.round((totalComp / totalClaim) * 1000) / 10 : 0,
      items,
    });
  }

  // remark summary
  const remarkMap = new Map<string, { unit: string; count: number; claim: number }>();
  for (const r of rows) {
    if (!r.หมายเหตุ) continue;
    const key = `${r.หมายเหตุ}|||${r.หน่วยบริการ}`;
    if (!remarkMap.has(key)) remarkMap.set(key, { unit: r.หน่วยบริการ, count: 0, claim: 0 });
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
    remarkSummary,
  };
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "billing.xlsx");
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "ไม่พบไฟล์ data/billing.xlsx — กรุณาอัปโหลดข้อมูลก่อน" }, { status: 404 });
    }
    const rows = parseXlsx(filePath);
    const data = buildDashboard(rows);
    return NextResponse.json(data);
  } catch (err) {
    console.error("BillingDashboard error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}