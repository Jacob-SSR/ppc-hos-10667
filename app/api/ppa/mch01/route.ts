import { NextResponse } from "next/server";
import { getPpaMch01 } from "@/lib/ppa.service";

export async function GET() {
    try {
        const data = await getPpaMch01();
        return NextResponse.json(data);
    } catch (error) {
        console.error("PPA MCH01 error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}