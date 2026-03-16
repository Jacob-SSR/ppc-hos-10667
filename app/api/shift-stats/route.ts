import { NextResponse } from "next/server";
import { getShiftStats } from "@/lib/shift-stats.service";

// ── ดึงเดือนปัจจุบัน (Bangkok timezone) อัตโนมัติ ─────────────────────────────
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

export async function GET() {
    try {
        const { start, end } = getCurrentMonthRange();
        const data = await getShiftStats(start, end);
        return NextResponse.json(data);
    } catch (error) {
        console.error("ShiftStats API error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}