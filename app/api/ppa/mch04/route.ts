import { NextResponse } from "next/server";
import { getPpaMch04 } from "@/lib/ppa.service";

export async function GET() {
    try {
        const data = await getPpaMch04();
        return NextResponse.json(data);
    } catch (error) {
        console.error("PPA MCH04 error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}