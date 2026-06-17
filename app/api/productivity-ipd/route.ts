// app/api/productivity-ipd/route.ts
// Dashboard ผลิตภาพการพยาบาล IPD — วันนี้ + ย้อนหลัง 7 วัน (census จาก HOSxP)
import { NextResponse } from "next/server";
import { getProductivityIpd } from "@/lib/productivity-ipd.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getProductivityIpd();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Productivity IPD API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(error) },
      { status: 500 },
    );
  }
}
