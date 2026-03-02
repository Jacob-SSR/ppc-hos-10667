import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start")!;
    const end = searchParams.get("end")!;

    const data = await getDashboardData(start, end);

    return NextResponse.json(data);
}