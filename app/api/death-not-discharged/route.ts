import { NextRequest, NextResponse } from "next/server";
import { getDeathNotDischarged } from "@/lib/report.service";

export async function GET(req: NextRequest) {
  try {
    const data = await getDeathNotDischarged();
    return NextResponse.json(data);
  } catch (error) {
    console.error("DeathNotDischarged API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
