import { NextRequest, NextResponse } from "next/server";
import { getIpdDischarge } from "@/lib/ipd.service";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const start = searchParams.get("start");
        const end = searchParams.get("end");

        if (!start || !end) {
            return NextResponse.json(
                { error: "Missing start or end parameter" },
                { status: 400 }
            );
        }

        const data = await getIpdDischarge(start, end);
        return NextResponse.json(data);
    } catch (error) {
        console.error("IPD discharge error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}