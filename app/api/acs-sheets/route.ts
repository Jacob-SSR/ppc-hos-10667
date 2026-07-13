// app/api/acs-sheets/route.ts
// โค้ด parse ย้ายไป lib/acsSheets.service.ts (แชร์กับ /api/acs-map)
import { NextRequest, NextResponse } from "next/server";
import { sheetsError } from "@/lib/sheets";
import {
  getAcsSheetsCached,
  type AcsPatient,
  type AcsSummary,
  type AcsKpiYearValue,
  type AcsKpiItem,
  type AcsKpiBlock,
  type AcsSheetsData,
} from "@/lib/acsSheets.service";

// re-export ให้ frontend เดิมที่ import type จาก route นี้ยังใช้ได้
export type {
  AcsPatient,
  AcsSummary,
  AcsKpiYearValue,
  AcsKpiItem,
  AcsKpiBlock,
  AcsSheetsData,
};

export async function GET(req: NextRequest) {
  try {
    const year = req.nextUrl.searchParams.get("year") ?? "";
    const payload = await getAcsSheetsCached(year);
    return NextResponse.json(payload);
  } catch (err) {
    return sheetsError(err, "AcsSheets");
  }
}
