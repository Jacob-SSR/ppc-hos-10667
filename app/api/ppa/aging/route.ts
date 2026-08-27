import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { getPpaAging } from "@/lib/ppa.service";

// ข้อมูล PPA อัปเดตเป็นรอบวัน — cache 10 นาที (จอ dashboard poll ถี่กว่านั้นมาก)
const TTL_SECONDS = 600;

export async function GET(req: Request) {
  try {
    return await cachedJson(req, ["ppa-aging"], getPpaAging, TTL_SECONDS);
  } catch (error) {
    console.error("PPA AGING error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
