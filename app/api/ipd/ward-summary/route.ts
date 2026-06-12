import { NextResponse } from "next/server";
import { getIpdWardSummary } from "@/lib/ipd.service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });
  }

  try {
    const data = await getIpdWardSummary(start, end);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Ward summary API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
