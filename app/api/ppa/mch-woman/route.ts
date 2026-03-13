import { NextResponse } from "next/server";
import { getPpaMchWoman } from "@/lib/ppa.service";

export async function GET() {
    try {
        const data = await getPpaMchWoman();
        return NextResponse.json(data);
    } catch (error) {
        console.error("PPA MCH WOMAN error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}