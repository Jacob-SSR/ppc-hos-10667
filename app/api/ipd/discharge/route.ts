import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { getIpdDischarge } from "@/lib/ipd.service";

// รายการจำหน่ายใกล้ realtime — query จริงทุก 2 นาทีพอ
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
      ["ipd-discharge", start, end],
      () => getIpdDischarge(start, end),
      TTL_SECONDS,
    );
  } catch (error) {
    console.error("IPD discharge error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
