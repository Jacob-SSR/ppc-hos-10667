// app/api/sheets-modified/route.ts
// เวลาที่ Google Sheet แต่ละไฟล์ถูกแก้ไขล่าสุด (จาก Drive API)
//   GET /api/sheets-modified?keys=stroke,pikad → เฉพาะชีตที่ระบุ
//   GET /api/sheets-modified                   → ทุกชีตใน SHEET_SOURCES
import { NextResponse } from "next/server";
import {
  SHEET_SOURCES,
  isSheetSourceKey,
  getSheetsModified,
  sheetsError,
  type SheetSourceKey,
} from "@/lib/sheets";

export async function GET(req: Request) {
  try {
    const param = new URL(req.url).searchParams.get("keys");
    const keys: SheetSourceKey[] = param
      ? [...new Set(param.split(",").map((k) => k.trim()))].filter(isSheetSourceKey)
      : (Object.keys(SHEET_SOURCES) as SheetSourceKey[]);

    return NextResponse.json({ items: await getSheetsModified(keys) });
  } catch (err) {
    return sheetsError(err, "SheetsModified");
  }
}
