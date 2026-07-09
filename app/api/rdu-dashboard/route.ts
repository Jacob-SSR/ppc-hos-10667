// app/api/rdu-dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  queryDiseaseSummary,
  queryTrend,
  queryDoctors,
  queryTopAtb,
  queryAtbByDisease,
} from "@/lib/rdu.queries";
import { cachedQuery } from "@/lib/cache";
import type { RduDashboardData } from "@/lib/rdu.types";
import { THAI_MONTHS_SHORT } from "@/lib/rdu.constants";

// รายงาน RDU เป็นข้อมูลย้อนหลัง 12 เดือน ไม่ต้องสดมาก → 15 นาที
const TTL_SECONDS = 900;

function getDefaultRange() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
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
    const start = searchParams.get("start") ?? defaults.start;
    const end = searchParams.get("end") ?? defaults.end;
    const depcode = searchParams.get("depcode") ?? undefined;

    // ── ชั้นที่ 1: ส่วนที่ไม่ขึ้นกับ depcode (4 queries) — key ไม่มี depcode
    //    เปลี่ยนแผนกไปมาก็ hit cache เดิม ไม่ query ซ้ำ
    // ── ชั้นที่ 2: diseases ขึ้นกับ depcode — key แยกตามแผนก
    const [common, diseases] = await Promise.all([
      cachedQuery(
        ["rdu-common", start, end],
        async () => {
          const [trend, doctors, topAtb, atbByDisease] = await Promise.all([
            queryTrend(start, end),
            queryDoctors(start, end),
            queryTopAtb(start, end),
            queryAtbByDisease(start, end),
          ]);
          return { trend, doctors, topAtb, atbByDisease };
        },
        TTL_SECONDS,
      ),
      cachedQuery(
        ["rdu-diseases", start, end, depcode ?? "all"],
        () => queryDiseaseSummary(start, end, depcode),
        TTL_SECONDS,
      ),
    ]);

    const data: RduDashboardData = {
      updatedAt: new Date().toISOString(),
      start,
      end,
      diseases,
      trend: common.trend,
      doctors: common.doctors,
      topAtb: common.topAtb,
      atbByDisease: common.atbByDisease as RduDashboardData["atbByDisease"],
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error("RDU Dashboard error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
