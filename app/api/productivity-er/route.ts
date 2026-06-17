// app/api/productivity-er/route.ts
// Dashboard ผลิตภาพการพยาบาล ER — วันนี้ + ย้อนหลัง 7 วัน (ดึงจาก HOSxP)
import { NextResponse } from "next/server";
import { getProductivityEr } from "@/lib/productivity-er.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getProductivityEr();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Productivity ER API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(error) },
      { status: 500 },
    );
  }
}
