import { NextResponse } from "next/server";
import { getPpaNcd01 } from "@/lib/ppa.service";

export async function GET() {
    try {
        const data = await getPpaNcd01();
        return NextResponse.json(data);
    } catch (error) {
        console.error("PPA NCD01 error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}