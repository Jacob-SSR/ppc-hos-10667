import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard";

function getCurrentMonthRange(): { start: string; end: string } {
    const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
    );
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    return {
        start: `${y}-${m}-01`,
        end: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
    };
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    const { start, end } = startParam && endParam
        ? { start: startParam, end: endParam }
        : getCurrentMonthRange();

    try {
        const data = await getDashboardData(start, end);
        return NextResponse.json({ ...data, start, end });
    } catch (error) {
        console.error("Dashboard API error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}