// app/api/ktb-dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getSheetClient,
  getFirstSheetTitle,
  getValues,
  parseDate,
  sheetsError,
} from "@/lib/sheets";
import { cachedQuery, invalidate } from "@/lib/cache";

// ─── แหล่งข้อมูล + Cache ──────────────────────────────────────────────────────
const SPREADSHEET_ID = process.env.KTB_SPREADSHEET_ID!;
const SHEET_NAME = process.env.KTB_SHEET_NAME || "";
const CACHE_KEY = "ktb-dashboard";
const TTL = 900; // 15 นาที — ข้อมูลงวดจ่ายอัปเดตเป็นรอบ ไม่ต้องถี่

export interface KtbRow {
  repNo: string;
  transId: string;
  cid: string;
  ชื่อสกุล: string;
  สิทธิ: string;
  hmainOP: string;
  วันส่งข้อมูล: string;
  วันรับบริการ: string;
  รายการขอเบิก: string;
  จำนวน: number;
  ราคาต่อหน่วย: number;
  ราคาเพดาน: number;
  รวมขอเบิก: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  สถานะ: string;
  หมายเหตุ: string;
  hcodeKey: string;
  หน่วยบริการ: string;
  งวดจ่าย: string;
}

export interface KtbServiceSummary {
  รายการขอเบิก: string;
  รายการสั้น: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  สถานะ: string;
}

export interface KtbUnitSummary {
  หน่วยบริการ: string;
  hcodeKey: string;
  isHospital: boolean;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  รายการ: KtbServiceSummary[];
}

export interface KtbBatchSummary {
  งวดจ่าย: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  หน่วยบริการ: KtbUnitSummary[];
}

export interface KtbDashboardData {
  updatedAt: string;
  totalRows: number;
  totalClaim: number;
  totalComp: number;
  totalNoComp: number;
  totalPending: number;
  batches: KtbBatchSummary[];
  units: KtbUnitSummary[];
}

// ─── HCODE MAP ────────────────────────────────────────────────────────────────
const HCODE_MAP: Record<string, { name: string; isHospital: boolean }> = {
  "10909": { name: "โรงพยาบาลพลับพลาชัย", isHospital: true },
  "03044": { name: "รพ.สต.บ้านจันดุม", isHospital: false },
  "03045": { name: "รพ.สต.บ้านโคกเจริญ", isHospital: false },
  "03046": { name: "รพ.สต.บ้านโคกขมิ้น", isHospital: false },
  "03047": { name: "รพ.สต.ตาพระ", isHospital: false },
  "03048": { name: "รพ.สต.บ้านป่าชัน", isHospital: false },
  "03049": { name: "รพ.สต.สำโรง", isHospital: false },
};

// ─── SERVICE SHORT LABELS ─────────────────────────────────────────────────────
const SERVICE_SHORT: Record<string, string> = {
  "ฉีดวัคซีนป้องกันโรคป้องกันโรคไข้หวัดใหญ่ตามฤดูกาล(7กลุ่มเสี่ยง)":
    "วัคซีนไข้หวัดใหญ่",
  วัคซีนป้องกันโรคไข้หวัดใหญ่ตามฤดูกาล: "วัคซีนไข้หวัดใหญ่",
  "การตรวจคัดกรองโรคไวรัสตับอักเสบ ซี": "ตรวจตับอักเสบ C",
  "บริการตรวจคัดกรองไวรัสตับอักเสบ บี": "ตรวจตับอักเสบ B",
  ค่าบริการเก็บตัวอย่าง: "เก็บตัวอย่าง",
};

/** Sheets API คืน formatted string เช่น "1,234.50" → strip comma ก่อนแปลง */
function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

function normalizeHcode(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const n = Math.round(Number(String(raw).replace(/,/g, "").trim()));
  if (isNaN(n)) return "";
  // 5 digit เช่น 3045 → 03045, 10909 → 10909
  return n < 10000 ? `0${n}` : String(n);
}

// ─── อ่านข้อมูลจาก Google Sheets ──────────────────────────────────────────────
// layout เดียวกับ KTB.xlsx เดิม: row 0–3 = headers, data เริ่ม row 4, งวดจ่าย = col B
async function fetchRows(): Promise<KtbRow[]> {
  const sheets = await getSheetClient();
  const sheetName =
    SHEET_NAME || (await getFirstSheetTitle(sheets, SPREADSHEET_ID));
  const raw = await getValues(sheets, SPREADSHEET_ID, `'${sheetName}'!A:AB`);

  const rows: KtbRow[] = [];
  for (let i = 4; i < raw.length; i++) {
    const r = raw[i] ?? [];
    const งวดจ่าย = r[1] ? String(r[1]).trim() : "";
    if (!งวดจ่าย) continue; // skip blank

    const hcodeKey = normalizeHcode(r[27]);
    const hcodeInfo = HCODE_MAP[hcodeKey];
    const รายการขอเบิก = String(r[13] ?? "").trim();

    rows.push({
      repNo: String(r[2] ?? ""),
      transId: String(r[3] ?? ""),
      cid: String(r[6] ?? ""),
      ชื่อสกุล: String(r[7] ?? ""),
      สิทธิ: String(r[8] ?? ""),
      hmainOP: String(r[9] ?? ""),
      วันส่งข้อมูล: parseDate(r[10]),
      วันรับบริการ: parseDate(r[11]),
      รายการขอเบิก,
      จำนวน: toNum(r[14]),
      ราคาต่อหน่วย: toNum(r[15]),
      ราคาเพดาน: toNum(r[16]),
      รวมขอเบิก: toNum(r[17]),
      ชดเชย: toNum(r[20]),
      ไม่ชดเชย: toNum(r[21]),
      สถานะ: String(r[24] ?? "").trim(),
      หมายเหตุ: String(r[25] ?? "").trim(),
      hcodeKey,
      หน่วยบริการ: hcodeInfo?.name ?? `หน่วยบริการ ${hcodeKey}`,
      งวดจ่าย,
    });
  }
  return rows;
}

function buildDashboard(rows: KtbRow[]): KtbDashboardData {
  // ─── สรุปตาม unit ──────────────────────────────────────────────────────────
  const unitMap = new Map<string, Map<string, { rows: KtbRow[] }>>();

  for (const r of rows) {
    if (!unitMap.has(r.hcodeKey)) unitMap.set(r.hcodeKey, new Map());
    const svcMap = unitMap.get(r.hcodeKey)!;
    const key = `${r.รายการขอเบิก}|||${r.สถานะ}`;
    if (!svcMap.has(key)) svcMap.set(key, { rows: [] });
    svcMap.get(key)!.rows.push(r);
  }

  const sortedUnitKeys = Array.from(unitMap.keys()).sort((a, b) => {
    const aH = HCODE_MAP[a]?.isHospital ? 0 : 1;
    const bH = HCODE_MAP[b]?.isHospital ? 0 : 1;
    return aH - bH || a.localeCompare(b);
  });

  const units: KtbUnitSummary[] = sortedUnitKeys.map((hcodeKey) => {
    const svcMap = unitMap.get(hcodeKey)!;
    const info = HCODE_MAP[hcodeKey];
    const รายการ: KtbServiceSummary[] = [];

    for (const [key, { rows: sr }] of svcMap) {
      const [รายการขอเบิก, สถานะ] = key.split("|||");
      รายการ.push({
        รายการขอเบิก,
        รายการสั้น: SERVICE_SHORT[รายการขอเบิก] ?? รายการขอเบิก,
        จำนวน: sr.length,
        เรียกเก็บ: sr.reduce((s, r) => s + r.รวมขอเบิก, 0),
        ชดเชย: sr.reduce((s, r) => s + r.ชดเชย, 0),
        ไม่ชดเชย: sr.reduce((s, r) => s + r.ไม่ชดเชย, 0),
        สถานะ,
      });
    }

    return {
      หน่วยบริการ: info?.name ?? `หน่วยบริการ ${hcodeKey}`,
      hcodeKey,
      isHospital: info?.isHospital ?? false,
      จำนวน: รายการ.reduce((s, i) => s + i.จำนวน, 0),
      เรียกเก็บ: รายการ.reduce((s, i) => s + i.เรียกเก็บ, 0),
      ชดเชย: รายการ.reduce((s, i) => s + i.ชดเชย, 0),
      ไม่ชดเชย: รายการ.reduce((s, i) => s + i.ไม่ชดเชย, 0),
      รายการ,
    };
  });

  // ─── สรุปตามงวดจ่าย ────────────────────────────────────────────────────────
  const batchMap = new Map<string, KtbRow[]>();
  for (const r of rows) {
    if (!batchMap.has(r.งวดจ่าย)) batchMap.set(r.งวดจ่าย, []);
    batchMap.get(r.งวดจ่าย)!.push(r);
  }

  const batches: KtbBatchSummary[] = Array.from(batchMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([งวดจ่าย, bRows]) => {
      // unit breakdown ในงวดนี้
      const bUnitMap = new Map<string, KtbRow[]>();
      for (const r of bRows) {
        if (!bUnitMap.has(r.hcodeKey)) bUnitMap.set(r.hcodeKey, []);
        bUnitMap.get(r.hcodeKey)!.push(r);
      }

      const batchUnits: KtbUnitSummary[] = Array.from(bUnitMap.entries())
        .sort(([a], [b]) => {
          const aH = HCODE_MAP[a]?.isHospital ? 0 : 1;
          const bH = HCODE_MAP[b]?.isHospital ? 0 : 1;
          return aH - bH || a.localeCompare(b);
        })
        .map(([hc, uRows]) => {
          const info = HCODE_MAP[hc];
          // service breakdown
          const svcMap2 = new Map<string, KtbRow[]>();
          for (const r of uRows) {
            const k = `${r.รายการขอเบิก}|||${r.สถานะ}`;
            if (!svcMap2.has(k)) svcMap2.set(k, []);
            svcMap2.get(k)!.push(r);
          }
          const รายการ: KtbServiceSummary[] = Array.from(svcMap2.entries()).map(
            ([key, sr]) => {
              const [รายการขอเบิก, สถานะ] = key.split("|||");
              return {
                รายการขอเบิก,
                รายการสั้น: SERVICE_SHORT[รายการขอเบิก] ?? รายการขอเบิก,
                จำนวน: sr.length,
                เรียกเก็บ: sr.reduce((s, r) => s + r.รวมขอเบิก, 0),
                ชดเชย: sr.reduce((s, r) => s + r.ชดเชย, 0),
                ไม่ชดเชย: sr.reduce((s, r) => s + r.ไม่ชดเชย, 0),
                สถานะ,
              };
            },
          );

          return {
            หน่วยบริการ: info?.name ?? `หน่วยบริการ ${hc}`,
            hcodeKey: hc,
            isHospital: info?.isHospital ?? false,
            จำนวน: uRows.length,
            เรียกเก็บ: uRows.reduce((s, r) => s + r.รวมขอเบิก, 0),
            ชดเชย: uRows.reduce((s, r) => s + r.ชดเชย, 0),
            ไม่ชดเชย: uRows.reduce((s, r) => s + r.ไม่ชดเชย, 0),
            รายการ,
          };
        });

      return {
        งวดจ่าย,
        จำนวน: bRows.length,
        เรียกเก็บ: bRows.reduce((s, r) => s + r.รวมขอเบิก, 0),
        ชดเชย: bRows.reduce((s, r) => s + r.ชดเชย, 0),
        ไม่ชดเชย: bRows.reduce((s, r) => s + r.ไม่ชดเชย, 0),
        หน่วยบริการ: batchUnits,
      };
    });

  const totalClaim = rows.reduce((s, r) => s + r.รวมขอเบิก, 0);
  const totalComp = rows.reduce((s, r) => s + r.ชดเชย, 0);
  const totalNoComp = rows.reduce((s, r) => s + r.ไม่ชดเชย, 0);

  return {
    updatedAt: new Date().toISOString(),
    totalRows: rows.length,
    totalClaim,
    totalComp,
    totalNoComp,
    totalPending: Math.max(0, totalComp - totalNoComp), // ชดเชยแล้วแต่ยังไม่โอน
    batches,
    units,
  };
}

// ถูกเรียกเฉพาะตอน cache miss
async function buildKtbData(): Promise<KtbDashboardData> {
  const rows = await fetchRows();
  return buildDashboard(rows);
}

export async function GET(req: NextRequest) {
  try {
    // ?refresh=1 → ล้าง cache แล้วดึงจาก Sheets ใหม่ (ปุ่มรีเฟรชในหน้า dashboard)
    if (req.nextUrl.searchParams.get("refresh") === "1") {
      await invalidate(CACHE_KEY);
    }

    const data = await cachedQuery([CACHE_KEY], buildKtbData, TTL);
    return NextResponse.json(data);
  } catch (err) {
    return sheetsError(err, "KtbDashboard");
  }
}
