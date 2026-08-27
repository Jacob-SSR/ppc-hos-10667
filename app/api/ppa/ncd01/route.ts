import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { getPpaNcd01 } from "@/lib/ppa.service";

// ข้อมูล PPA อัปเดตเป็นรอบวัน — cache 10 นาที (จอ dashboard poll ถี่กว่านั้นมาก)
const TTL_SECONDS = 600;

export async function GET(req: Request) {
  try {
    return await cachedJson(req, ["ppa-ncd01"], getPpaNcd01, TTL_SECONDS);
  } catch (error) {
    console.error("PPA NCD01 error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
