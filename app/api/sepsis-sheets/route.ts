// app/api/sepsis-sheets/route.ts
// โค้ด parse/summary ย้ายไป lib/sepsisSheets.service.ts (แชร์กับ /api/sepsis-map)
import { NextResponse } from "next/server";
import { sheetsError } from "@/lib/sheets";
import {
  getSepsisSheetsCached,
  type SepsisSheetRow,
} from "@/lib/sepsisSheets.service";

// re-export ให้ frontend เดิมที่ import type จาก route นี้ยังใช้ได้
export type { SepsisSheetRow };

export async function GET() {
  try {
    const payload = await getSepsisSheetsCached();
    return NextResponse.json(payload);
  } catch (err) {
    return sheetsError(err, "SepsisSheets");
  }
}
