import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseAgeRange, POPULATION_REPORT_SQL } from "@/lib/population-report";

export async function GET(req: NextRequest) {
  let ages: [number, number];
  try {
    ages = parseAgeRange(req.nextUrl.searchParams);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ช่วงอายุไม่ถูกต้อง" },
      { status: 400 },
    );
  }
  try {
    const [rows] = await db.query(POPULATION_REPORT_SQL, ages);
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "โหลดรายงานไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
