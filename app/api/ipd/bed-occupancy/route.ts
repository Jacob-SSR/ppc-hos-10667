import { NextResponse } from "next/server";
import { getBedOccupancy } from "@/lib/ipd.service";

export async function GET() {
  try {
    const data = await getBedOccupancy();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Bed occupancy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
