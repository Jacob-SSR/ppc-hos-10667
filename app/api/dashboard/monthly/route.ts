import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { getMonthlyDashboardData } from "@/lib/dashboard";

// ย้อนหลังรายเดือน — ข้อมูลเปลี่ยนช้า cache ยาวได้
const TTL_SECONDS = 900;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const months = Number(searchParams.get("months") ?? 6);

  try {
    return await cachedJson(
      req,
      ["dashboard-monthly", months],
      () => getMonthlyDashboardData(months),
      TTL_SECONDS,
    );
  } catch (error) {
    console.error("Monthly Dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
