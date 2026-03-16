import { NextResponse } from "next/server";
import { getPpaNcd02 } from "@/lib/ppa.service";

export async function GET() {
    try {
        const data = await getPpaNcd02();
        return NextResponse.json(data);
    } catch (error) {
        console.error("PPA NCD02 error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}