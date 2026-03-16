import { NextResponse } from "next/server";
import { getPpaMch02 } from "@/lib/ppa.service";

export async function GET() {
    try {
        const data = await getPpaMch02();
        return NextResponse.json(data);
    } catch (error) {
        console.error("PPA MCH02 error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}