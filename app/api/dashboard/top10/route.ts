import { NextResponse } from "next/server";
import { getTop10Diagnoses } from "@/lib/dashboard";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });
  }

  try {
    const data = await getTop10Diagnoses(start, end);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Top10 API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
