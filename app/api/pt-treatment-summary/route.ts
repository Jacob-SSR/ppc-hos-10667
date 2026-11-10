import { NextResponse } from "next/server";
import { parsePtTreatmentFilters } from "@/lib/pt-treatment-summary";
import { getPtTreatmentCatalog, getPtTreatmentReport } from "@/lib/pt-treatment-summary.service";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (params.get("mode") === "catalog") {
    try {
      return NextResponse.json(await getPtTreatmentCatalog(), { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("PT treatment catalog:", error);
      return NextResponse.json({ error: "โหลดทะเบียนหัตถการไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
    }
  }
  let filters;
  try { filters = parsePtTreatmentFilters(params); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "เงื่อนไขรายงานไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getPtTreatmentReport(filters), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("PT treatment summary:", error);
    return NextResponse.json({ error: "โหลดรายงานไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
