import { NextResponse } from "next/server";
import { getPpaAging } from "@/lib/ppa.service";

export async function GET() {
    try {
        const data = await getPpaAging();
        return NextResponse.json(data);
    } catch (error) {
        console.error("PPA AGING error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}