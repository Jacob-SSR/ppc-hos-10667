// app/api/drug-usage/route.ts
// สรุปยอดการใช้เวชภัณฑ์ตามมูลค่าการใช้ทั้งหมดในสถานบริการ
// รับ ?preset=today|thismonth|fiscal  หรือ  ?start=YYYY-MM-DD&end=YYYY-MM-DD
//     ?fy=2569 — ปีงบประมาณ พ.ศ. (ใช้กับ preset=fiscal, default = ปีงบปัจจุบัน)
//     ?kind=drug (เวชภัณฑ์ยา — default) | nondrug (เวชภัณฑ์ที่ไม่ใช่ยา) | lab (ตรวจทางห้องปฏิบัติการ)
import { NextResponse } from "next/server";
import { getDrugUsageDashboard, isItemKind } from "@/lib/drugUsage.service";
import { cachedQuery } from "@/lib/cache";

export const dynamic = "force-dynamic";

// ข้อมูลค่าใช้จ่ายไม่ต้องสดระดับวินาที + query ค่อนข้างหนัก → 10 นาที
const TTL_SECONDS = 600;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function bangkokToday(): Date {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** ปีงบประมาณ พ.ศ. ปัจจุบัน (ปีงบเริ่ม 1 ต.ค.) */
function currentFiscalYear(today: Date): number {
  return today.getFullYear() + 543 + (today.getMonth() >= 9 ? 1 : 0);
}

/**
 * ช่วงวันของปีงบประมาณ พ.ศ. ที่ระบุ — 1 ต.ค. ปีก่อนหน้า ถึง 30 ก.ย.
 * ปีงบปัจจุบันตัดปลายที่ "วันนี้" (ยังไม่จบปีงบ)
 */
function fiscalRange(fyBE: number, today: Date): { start: string; end: string } {
  const ceEnd = fyBE - 543; // ปี ค.ศ. ที่ปีงบสิ้นสุด
  const fyEnd = new Date(ceEnd, 8, 30); // 30 ก.ย.
  return {
    start: fmt(new Date(ceEnd - 1, 9, 1)), // 1 ต.ค. ปีก่อนหน้า
    end: fmt(fyEnd < today ? fyEnd : today),
  };
}

function rangeFromPreset(preset: string, fy: number | null): { start: string; end: string } {
  const today = bangkokToday();
  const end = fmt(today);

  if (preset === "thismonth")
    return { start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), end };
  if (preset === "fiscal")
    return fiscalRange(fy ?? currentFiscalYear(today), today);
  return { start: end, end }; // today
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const preset = searchParams.get("preset") ?? "today";
    const kindParam = searchParams.get("kind");
    const kind = isItemKind(kindParam) ? kindParam : "drug";

    // ปีงบประมาณ พ.ศ. — รับเฉพาะค่าที่สมเหตุสมผล (2500–2699)
    const fyRaw = Number(searchParams.get("fy"));
    const fy = Number.isInteger(fyRaw) && fyRaw >= 2500 && fyRaw <= 2699 ? fyRaw : null;

    const useCustom =
      !!startParam &&
      !!endParam &&
      DATE_RE.test(startParam) &&
      DATE_RE.test(endParam);

    let { start, end } = useCustom
      ? { start: startParam as string, end: endParam as string }
      : rangeFromPreset(preset, fy);

    if (start > end) [start, end] = [end, start];

    const data = await cachedQuery(
      ["drug-usage", kind, start, end],
      () => getDrugUsageDashboard(start, end, kind),
      TTL_SECONDS,
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("Medical supply usage dashboard error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
