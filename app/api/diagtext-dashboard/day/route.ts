// app/api/diagtext-dashboard/day/route.ts
// visit OPD ของวันที่เลือก: diagtext ไหนเยอะสุด ใครลง และรายการ visit
import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { DAY_LIMIT, dayQueries, parseDay, personSourceLabel, summarizeDay, type DayRow } from "@/lib/diagtext-dashboard";
import { personSource, select } from "@/lib/diagtext-dashboard.server";

// เปิดดูวันนี้ระหว่างวันบ่อย — cache สั้นพอให้เห็นที่หมอเพิ่งลง
const TTL_SECONDS = 120;

export async function GET(req: NextRequest) {
  let date: string;
  try {
    date = parseDay(req.nextUrl.searchParams.get("date"));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "เงื่อนไขไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    return await cachedJson(req, ["diagtext", "day", date], async () => {
      const person = await personSource();
      const q = dayQueries(date, person);
      const rows = await select<DayRow>(q.rows);
      const [opd] = await select<{ c: number }>(q.opd);
      return {
        person_source: personSourceLabel(person),
        truncated: rows.length > DAY_LIMIT,
        ...summarizeDay(date, rows.slice(0, DAY_LIMIT), Number(opd?.c) || 0),
      };
    }, TTL_SECONDS);
  } catch (error) {
    console.error("diagtext-dashboard day API error:", error);
    return NextResponse.json({ error: "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
