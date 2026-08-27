import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { getIpdSummary } from "@/lib/ipd.service";

// สรุป IPD ใกล้ realtime — จอ dashboard poll ทุก 30 วิ แต่ query จริงพอทุก 2 นาที
const TTL_SECONDS = 120;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing start or end parameter" },
        { status: 400 },
      );
    }

    return await cachedJson(
      req,
      ["ipd-summary", start, end],
      () => getIpdSummary(start, end),
      TTL_SECONDS,
    );
  } catch (error) {
    console.error("IPD summary error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
