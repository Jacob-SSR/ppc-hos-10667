import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/lib/report.service";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
        return NextResponse.json(
            { message: "Missing date range" },
            { status: 400 }
        );
    }

    const data = await getReport(start, end);
    return NextResponse.json(data);
}

