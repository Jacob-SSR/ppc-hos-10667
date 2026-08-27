import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { getIpdWardSummary } from "@/lib/ipd.service";

// สรุปรายวอร์ดใกล้ realtime — query จริงทุก 2 นาทีพอ
const TTL_SECONDS = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });
  }

  try {
    return await cachedJson(
      req,
      ["ipd-ward-summary", start, end],
      () => getIpdWardSummary(start, end),
      TTL_SECONDS,
    );
  } catch (error) {
    console.error("Ward summary API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
