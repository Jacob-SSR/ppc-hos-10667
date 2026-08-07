// app/api/d506-report/route.ts
// รายงานโรค 506 จาก HOSxP (surveil_member) → หน้า /pages/d506-report
import { NextRequest, NextResponse } from "next/server";
import { getD506Report } from "@/lib/d506.service";

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

    const data = await getD506Report(start, end);
    return NextResponse.json(data);
  } catch (error) {
    console.error("D506Report API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
