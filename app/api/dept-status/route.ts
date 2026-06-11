// app/api/dept-status/route.ts
// Dashboard สถานะผู้ป่วยตามแผนก (OPD real-time)
// รับ ?date=YYYY-MM-DD (default = วันนี้ใน timezone Asia/Bangkok)
//      &debug=1 เพื่อดู sample
import { NextResponse } from "next/server";
import { getDeptStatus } from "@/lib/deptStatus.service";

export const dynamic = "force-dynamic";

function bangkokToday(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || bangkokToday();
    const debug = searchParams.get("debug") === "1";

    const data = await getDeptStatus(date);

    if (debug) {
      return NextResponse.json({
        date,
        totalVisits: data.totalVisits,
        totalActive: data.totalActive,
        cardCount: data.cards.length,
        cards: data.cards,
        samplePatients: data.patients.slice(0, 10),
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DeptStatus API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
