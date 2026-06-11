// app/api/dept-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDeptStatus } from "@/lib/deptStatus.service";
import { fmtDate, getBangkokToday } from "@/lib/thaiDate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // getBangkokToday() คืนค่าเป็น Date -> แปลงเป็น "YYYY-MM-DD" ด้วย fmtDate
    const date = searchParams.get("date") || fmtDate(getBangkokToday());
    const debug = searchParams.get("debug");

    const data = await getDeptStatus(date);

    if (debug) {
      // โหมด debug: ดูชื่อสถานะทั้งหมด + ตัวอย่างผู้ป่วย ไว้ปรับ keyword
      return NextResponse.json({
        date: data.date,
        totalVisits: data.totalVisits,
        totalActive: data.totalActive,
        totalDone: data.totalDone,
        byStatus: data.byStatus,
        sampleCards: data.cards.slice(0, 5),
        samplePatients: data.patients.slice(0, 20),
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[dept-status] error:", err);
    return NextResponse.json(
      { error: "failed to load dept status", detail: String(err) },
      { status: 500 },
    );
  }
}
