import { NextRequest, NextResponse } from "next/server";
import { getBedOccupancy } from "@/lib/ipd.service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const data = await getBedOccupancy(start ?? undefined, end ?? undefined);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Bed occupancy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
