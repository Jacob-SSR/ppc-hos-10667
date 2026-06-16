// app/api/anc-nursing/route.ts
// API รวมข้อมูล Dashboard งานการพยาบาลผู้คลอด
// query params: ?start=YYYY-MM-DD&end=YYYY-MM-DD (default = ปีงบประมาณปัจจุบัน)

import { NextResponse } from "next/server";
import {
  getAncSummary,
  getAncMissedAppts,
  getAncLaborAdmit,
  getAncReferOut,
  getAncAnemiaHct,
  getAncAnemiaHb,
  getAncDailyMonthly,
} from "@/lib/anc.service";

export const dynamic = "force-dynamic";

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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const def = defaultFiscalRange();
    const start = url.searchParams.get("start") || def.start;
    const end = url.searchParams.get("end") || def.end;

    const [
      summary,
      missedAppts,
      laborAdmit,
      referOut,
      anemiaHct,
      anemiaHb,
      daily,
    ] = await Promise.all([
      getAncSummary(start, end),
      getAncMissedAppts(start, end),
      getAncLaborAdmit(start, end),
      getAncReferOut(start, end),
      getAncAnemiaHct(start, end),
      getAncAnemiaHb(start, end),
      getAncDailyMonthly(start, end),
    ]);

    return NextResponse.json({
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
    });
  } catch (err) {
    console.error("ANC nursing dashboard error:", err);
    return NextResponse.json(
      { error: "ดึงข้อมูล ANC ไม่สำเร็จ: " + (err as Error).message },
      { status: 500 },
    );
  }
}
