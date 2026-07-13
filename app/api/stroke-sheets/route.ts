// app/api/stroke-sheets/route.ts
// โค้ด parse ย้ายไป lib/strokeSheets.service.ts (แชร์กับ /api/stroke-map)
import { NextResponse } from "next/server";
import { sheetsError } from "@/lib/sheets";
import {
  getStrokeSheetsCached,
  type StrokeSheetRow,
  type StrokeSheetsDashboardData,
} from "@/lib/strokeSheets.service";

// re-export ให้ frontend เดิมที่ import type จาก route นี้ยังใช้ได้
export type { StrokeSheetRow, StrokeSheetsDashboardData };

export async function GET(req: Request) {
  try {
    if (!process.env.STROKE_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "ไม่ได้ตั้งค่า STROKE_SPREADSHEET_ID ใน .env" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(req.url);
    const debug = searchParams.get("debug") === "1";

    const data = await getStrokeSheetsCached();

    if (debug) {
      return NextResponse.json(data); // รวม debug + updatedAt = เวลา query จริง
    }

    const { debug: _d, ...publicData } = data;
    return NextResponse.json(publicData);
  } catch (err) {
    return sheetsError(err, "StrokeSheets");
  }
}
