// app/api/anc-nursing/route.ts
import { NextResponse } from "next/server";
import { cachedQuery } from "@/lib/cache";
import {
  getAncSummary,
  getAncMissedAppts,
  getAncLaborAdmit,
  getAncReferOut,
  getAncAnemiaHct,
  getAncAnemiaHb,
  getAncDailyMonthly,
  getAncAnc5ByMonth,
} from "@/lib/anc.service";

export const dynamic = "force-dynamic";

// cache 10 นาที — ข้อมูล ANC ไม่ realtime มาก แต่อยากให้เห็นเคสใหม่ภายในช่วงเช้า/บ่าย
// (hard TTL จริงใน lib/cache.ts = ttl * 4 → มี stale แจกต่ออีก ~40 นาทีถ้า DB มีปัญหา)
const TTL_SECONDS = 600;

/** ปีงบประมาณปัจจุบัน (1 ต.ค. – 30 ก.ย.) ใน timezone Asia/Bangkok */
function defaultFiscalRange(): { start: string; end: string } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  const fyStartYear = m >= 9 ? y : y - 1; // ต.ค. = เดือน 9
  return {
    start: `${fyStartYear}-10-01`,
    end: `${fyStartYear + 1}-09-30`,
  };
}

async function buildAncData(start: string, end: string) {
  const [
    summary,
    missedAppts,
    laborAdmit,
    referOut,
    anemiaHct,
    anemiaHb,
    daily,
    anc5ByMonth,
  ] = await Promise.all([
    getAncSummary(start, end),
    getAncMissedAppts(start, end),
    getAncLaborAdmit(start, end),
    getAncReferOut(start, end),
    getAncAnemiaHct(start, end),
    getAncAnemiaHb(start, end),
    getAncDailyMonthly(start, end),
    getAncAnc5ByMonth(start, end),
  ]);

  return {
    updatedAt: new Date().toISOString(),
    start,
    end,
    summary,
    missedAppts,
    laborAdmit,
    referOut,
    anemiaHct,
    anemiaHb,
    daily,
    anc5ByMonth,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const def = defaultFiscalRange();
    const start = url.searchParams.get("start") || def.start;
    const end = url.searchParams.get("end") || def.end;

    const data = await cachedQuery(
      ["anc-nursing", start, end],
      () => buildAncData(start, end),
      TTL_SECONDS,
    );

    return NextResponse.json(data);
  } catch (err) {
    console.error("ANC nursing dashboard error:", err);
    return NextResponse.json(
      { error: "ดึงข้อมูล ANC ไม่สำเร็จ: " + (err as Error).message },
      { status: 500 },
    );
  }
}
