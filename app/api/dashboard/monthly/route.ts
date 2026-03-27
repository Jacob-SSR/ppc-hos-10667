import { NextResponse } from "next/server";
import { getMonthlyDashboardData } from "@/lib/dashboard";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    const months = Number(searchParams.get("months") ?? 6);

    try {
        const data = await getMonthlyDashboardData(months);
        return NextResponse.json(data);
    } catch (error) {
        console.error("Monthly Dashboard API error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}