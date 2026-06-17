// app/api/productivity-lr/route.ts
// Dashboard ผลิตภาพการพยาบาลห้องคลอด (LR) — ย้อนหลัง N วัน (เฉพาะวันที่มีคลอด)
import { NextResponse } from "next/server";
import { getProductivityLr } from "@/lib/productivity-lr.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getProductivityLr();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Productivity LR API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(error) },
      { status: 500 },
    );
  }
}
