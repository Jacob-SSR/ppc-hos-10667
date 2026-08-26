// app/api/drug-usage/route.ts
// สรุปยอดการใช้เวชภัณฑ์ตามมูลค่าการใช้ทั้งหมดในสถานบริการ
// รับ ?preset=today|thismonth|fiscal|back  หรือ  ?start=YYYY-MM-DD&end=YYYY-MM-DD
//     ?fy=2569 — ปีงบประมาณ พ.ศ. (ใช้กับ preset=fiscal, default = ปีงบปัจจุบัน)
//     ?years=3 — จำนวนปีงบย้อนหลังรวมปีปัจจุบัน (ใช้กับ preset=back, 1–10)
//     ?kind=drug (เวชภัณฑ์ยา — default) | nondrug (เวชภัณฑ์ที่ไม่ใช่ยา) | lab (ตรวจทางห้องปฏิบัติการ)
//     ?section=core — KPI/ปีงบ/รายการ/แนวโน้ม (เบา เรนเดอร์ได้ทันที)
//                dims — แผนก/ผู้สั่งใช้/สิทธิ์ (หนักกว่า โหลดตามหลัง)
//                ไม่ระบุ = ทั้งหมด (ใช้กับงานที่อยากได้ครบทีเดียว)
import { NextResponse } from "next/server";
import {
  getDrugUsageCore,
  getDrugUsageDashboard,
  getDrugUsageDims,
  isItemKind,
} from "@/lib/drugUsage.service";
import { cachedQuery } from "@/lib/cache";

export const dynamic = "force-dynamic";

// ช่วงที่ยังไม่จบ (มีวันนี้อยู่ด้วย) ข้อมูลยังเพิ่มได้ → 10 นาที
const TTL_ONGOING = 600;
// ช่วงที่จบไปแล้ว (ปีงบเก่า/เดือนที่ผ่านมา) ข้อมูลนิ่งแล้ว → 24 ชม.
// ผลคือกดดูปีย้อนหลังซ้ำ ๆ แทบไม่เคยแตะ HOSxP อีกเลย
const TTL_CLOSED = 86_400;

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

function rangeFromPreset(
  preset: string,
  fy: number | null,
  years: number,
): { start: string; end: string } {
  const today = bangkokToday();
  const end = fmt(today);

  if (preset === "thismonth")
    return { start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), end };
  if (preset === "fiscal")
    return fiscalRange(fy ?? currentFiscalYear(today), today);
  if (preset === "back") {
    // ย้อนหลัง N ปีงบ "รวมปีงบปัจจุบัน" → เริ่ม 1 ต.ค. ของปีงบที่เก่าที่สุดในชุด
    const oldest = currentFiscalYear(today) - (years - 1);
    return { start: fiscalRange(oldest, today).start, end };
  }
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

    // จำนวนปีงบย้อนหลัง — จำกัด 1–10 กันเผลอลากช่วงยาวจน query หนักเกิน
    const yearsRaw = Math.trunc(Number(searchParams.get("years")));
    const years = Number.isFinite(yearsRaw) ? Math.min(10, Math.max(1, yearsRaw)) : 3;

    const useCustom =
      !!startParam &&
      !!endParam &&
      DATE_RE.test(startParam) &&
      DATE_RE.test(endParam);

    let { start, end } = useCustom
      ? { start: startParam as string, end: endParam as string }
      : rangeFromPreset(preset, fy, years);

    if (start > end) [start, end] = [end, start];

    const section = searchParams.get("section");
    const closed = end < fmt(bangkokToday()); // ช่วงจบแล้ว = ข้อมูลไม่เปลี่ยนอีก
    const ttl = closed ? TTL_CLOSED : TTL_ONGOING;

    const data =
      section === "core"
        ? await cachedQuery(
            ["drug-usage-core", kind, start, end],
            () => getDrugUsageCore(start, end, kind),
            ttl,
          )
        : section === "dims"
          ? await cachedQuery(
              ["drug-usage-dims", kind, start, end],
              () => getDrugUsageDims(start, end, kind),
              ttl,
            )
          : await cachedQuery(
              ["drug-usage", kind, start, end],
              () => getDrugUsageDashboard(start, end, kind),
              ttl,
            );

    return NextResponse.json(data, {
      headers: {
        // ให้เบราว์เซอร์เก็บไว้เองด้วย — สลับแท็บกลับไปมาในช่วงสั้น ๆ ไม่ต้องยิงซ้ำ
        "Cache-Control": closed
          ? "private, max-age=3600"
          : "private, max-age=60, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Medical supply usage dashboard error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
