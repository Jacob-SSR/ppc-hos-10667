// app/api/diagtext-dashboard/route.ts
// อันดับ diagtext ทั้งปีงบ / รายไตรมาส / รายเดือน + อันดับผู้ลง
import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { parseFiscalYear, personSourceLabel, summarizeYear, yearQueries, type CountRow, type PersonRow, type TextRow } from "@/lib/diagtext-dashboard";
import { personSource, select } from "@/lib/diagtext-dashboard.server";
import { currentReportYear } from "@/lib/report-period";

export async function GET(req: NextRequest) {
  let fy: number;
  try {
    fy = parseFiscalYear(req.nextUrl.searchParams.get("fy"));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "เงื่อนไขไม่ถูกต้อง" }, { status: 400 });
  }
  // ปีงบปัจจุบันข้อมูลยังเพิ่มทุกวัน → 30 นาที / ปีงบที่ปิดแล้ว → 6 ชั่วโมง
  const ttl = fy >= currentReportYear("fiscal").year ? 1800 : 21600;
  try {
    return await cachedJson(req, ["diagtext", "year", fy], async () => {
      const person = await personSource();
      const q = yearQueries(fy, person);
      const texts = await select<TextRow>(q.texts);
      const persons = await select<PersonRow>(q.persons);
      const opd = await select<CountRow>(q.opdByDay);
      const diag = await select<CountRow>(q.diagByDay);
      return { fiscal_year: fy, person_source: personSourceLabel(person), ...summarizeYear(fy, texts, persons, opd, diag) };
    }, ttl);
  } catch (error) {
    console.error("diagtext-dashboard API error:", error);
    return NextResponse.json({ error: "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
