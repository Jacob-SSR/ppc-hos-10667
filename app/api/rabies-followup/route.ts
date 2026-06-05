// app/api/rabies-followup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRabiesFollowupReport } from "@/lib/report.service";

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

    const data = await getRabiesFollowupReport(start, end);
    return NextResponse.json(data);
  } catch (error) {
    console.error("RabiesFollowup API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
