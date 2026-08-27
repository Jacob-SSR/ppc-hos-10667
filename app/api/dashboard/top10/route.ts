import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { getTop10Diagnoses } from "@/lib/dashboard";

// อันดับโรค — เปลี่ยนช้า
const TTL_SECONDS = 600;

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
      ["dashboard-top10", start, end],
      () => getTop10Diagnoses(start, end),
      TTL_SECONDS,
    );
  } catch (error) {
    console.error("Top10 API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
