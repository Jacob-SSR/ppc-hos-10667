import { NextResponse } from "next/server";
import { parseStaffDentalRequest } from "@/lib/staff-dental";
import { getStaffDentalReport } from "@/lib/staff-dental.service";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  let input;
  try {
    const text = await req.text();
    if (text.length > 500000) return NextResponse.json({ error: "ไฟล์รายชื่อใหญ่เกินไป" }, { status: 413, headers });
    input = parseStaffDentalRequest(JSON.parse(text));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ข้อมูลรายงานไม่ถูกต้อง" }, { status: 400, headers });
  }
  try { return NextResponse.json(await getStaffDentalReport(input), { headers }); }
  catch {
    // Do not log the SQL/error object: it contains the uploaded employee names.
    console.error("Staff dental report query failed");
    return NextResponse.json({ error: "ดึงข้อมูลทันตกรรมจาก HOSxP ไม่สำเร็จ กรุณาลองใหม่หรือติดต่อ IT" }, { status: 500, headers });
  }
}
