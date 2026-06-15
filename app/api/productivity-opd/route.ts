// app/api/productivity-opd/route.ts
// Dashboard ผลิตภาพการพยาบาล OPD — วันนี้ + ย้อนหลัง 7 วัน (ดึงจาก HOSxP)
import { NextRequest, NextResponse } from "next/server";
import {
  getProductivity,
  getProductivityDebug,
} from "@/lib/productivity.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // /api/productivity-opd?debug=1 → ดูว่าเลขหายตอนกรองชั้นไหน
    if (req.nextUrl.searchParams.get("debug") === "1") {
      const dbg = await getProductivityDebug();
      return NextResponse.json(dbg);
    }
    const data = await getProductivity();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Productivity OPD API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(error) },
      { status: 500 },
    );
  }
}
