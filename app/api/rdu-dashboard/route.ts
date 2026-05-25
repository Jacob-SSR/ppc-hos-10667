// app/api/rdu-dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  queryDiseaseSummary,
  queryTrend,
  queryDoctors,
  queryTopAtb,
  queryAtbByDisease,
} from "@/lib/rdu.queries";
import type { RduDashboardData } from "@/lib/rdu.types";
import { THAI_MONTHS_SHORT } from "@/lib/rdu.constants";

function getDefaultRange() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const s = new Date(now);
  s.setMonth(s.getMonth() - 12);
  s.setDate(1);
  const start = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const defaults = getDefaultRange();
    const start   = searchParams.get("start")   ?? defaults.start;
    const end     = searchParams.get("end")     ?? defaults.end;
    const depcode = searchParams.get("depcode") ?? undefined;

    // รัน queries พร้อมกัน (diseases ต้องรอเพราะ loop)
    const [diseases, trend, doctors, topAtb, atbByDisease] = await Promise.all([
      queryDiseaseSummary(start, end, depcode),
      queryTrend(start, end),
      queryDoctors(start, end),
      queryTopAtb(start, end),
      queryAtbByDisease(start, end),
    ]);

    const data: RduDashboardData = {
      updatedAt: new Date().toISOString(),
      start, end,
      diseases,
      trend,
      doctors,
      topAtb,
      atbByDisease: atbByDisease as RduDashboardData["atbByDisease"],
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error("RDU Dashboard error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}