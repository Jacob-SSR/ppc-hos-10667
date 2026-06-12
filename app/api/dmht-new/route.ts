// app/api/dmht-new/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDmhtNew } from "@/lib/dmht.service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { message: "Missing date range" },
      { status: 400 },
    );
  }

  try {
    const data = await getDmhtNew(start, end);
    return NextResponse.json(data);
  } catch (err) {
    console.error("dmht-new error:", err);
    return NextResponse.json(
      { message: "ดึงข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
