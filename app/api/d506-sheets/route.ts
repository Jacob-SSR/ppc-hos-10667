// app/api/d506-sheets/route.ts
// ทะเบียนคุมผู้ป่วยโรค 506 จาก Google Sheet → หน้า /pages/d506-dashboard
import { NextResponse } from "next/server";
import { sheetsError } from "@/lib/sheets";
import { getD506SheetsCached, type D506Row } from "@/lib/d506Sheets.service";

export type { D506Row };

export async function GET() {
  try {
    const payload = await getD506SheetsCached();
    return NextResponse.json(payload);
  } catch (err) {
    return sheetsError(err, "D506Sheets");
  }
}
