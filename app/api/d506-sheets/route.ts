// app/api/d506-sheets/route.ts
// ทะเบียนคุมผู้ป่วยโรค 506 จาก Google Sheet → หน้า /pages/d506-dashboard
import { NextRequest, NextResponse } from "next/server";
import { sheetsError } from "@/lib/sheets";
import {
  getD506SheetsCached,
  invalidateD506Sheets,
  type D506Row,
} from "@/lib/d506Sheets.service";

export type { D506Row };

export async function GET(req: NextRequest) {
  try {
    // ?refresh=1 → ล้าง cache แล้วอ่าน Sheet ใหม่ (ปุ่มรีโหลดในหน้า dashboard)
    // ไม่งั้นเจ้าหน้าที่เพิ่งกรอกทะเบียนเสร็จ จะยังเห็นของเก่าได้ถึง 5–20 นาที
    if (req.nextUrl.searchParams.get("refresh") === "1") {
      await invalidateD506Sheets();
    }

    const payload = await getD506SheetsCached();
    return NextResponse.json(payload);
  } catch (err) {
    return sheetsError(err, "D506Sheets");
  }
}
