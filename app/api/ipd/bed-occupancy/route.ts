import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { getBedOccupancy } from "@/lib/ipd.service";

// อัตราครองเตียงใกล้ realtime — query จริงทุก 2 นาทีพอ
const TTL_SECONDS = 120;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    return await cachedJson(
      req,
      ["ipd-bed-occupancy", start ?? "-", end ?? "-"],
      () => getBedOccupancy(start ?? undefined, end ?? undefined),
      TTL_SECONDS,
    );
  } catch (error) {
    console.error("Bed occupancy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
