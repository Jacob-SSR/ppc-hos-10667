import { NextRequest, NextResponse } from "next/server";
import { getUcOutsideDentalReport } from "@/lib/report.service";

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

    try {
        const data = await getUcOutsideDentalReport(start, end);
        return NextResponse.json(data);
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { message: "Internal Server Error" },
            { status: 500 }
        );
    }
}