// app/api/drug-usage/route.ts
// สรุปยอดการใช้เวชภัณฑ์ตามมูลค่าการใช้ทั้งหมดในสถานบริการ
// รับ ?preset=today|7days|30days|thismonth|thisyear|fiscal  หรือ  ?start=YYYY-MM-DD&end=YYYY-MM-DD
//     ?kind=drug (เวชภัณฑ์ยา — default) | nondrug (เวชภัณฑ์ที่ไม่ใช่ยา)
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

function rangeFromPreset(preset: string): { start: string; end: string } {
  const today = bangkokToday();
  const end = fmt(today);

  if (preset === "7days" || preset === "30days") {
    const days = preset === "7days" ? 6 : 29;
    const s = new Date(today);
    s.setDate(s.getDate() - days);
    return { start: fmt(s), end };
  }
  if (preset === "thismonth")
    return { start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), end };
  if (preset === "thisyear")
    return { start: fmt(new Date(today.getFullYear(), 0, 1)), end };
  if (preset === "fiscal") {
    // ปีงบประมาณเริ่ม 1 ต.ค.
    const y = today.getMonth() >= 9 ? today.getFullYear() : today.getFullYear() - 1;
    return { start: fmt(new Date(y, 9, 1)), end };
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

    const useCustom =
      !!startParam &&
      !!endParam &&
      DATE_RE.test(startParam) &&
      DATE_RE.test(endParam);

    let { start, end } = useCustom
      ? { start: startParam as string, end: endParam as string }
      : rangeFromPreset(preset);

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
