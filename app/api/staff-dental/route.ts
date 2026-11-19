import { NextResponse } from "next/server";
import { parseStaffDentalFilters } from "@/lib/staff-dental";
import { getStaffDentalReport, getStaffDentalDepartments, StaffDentalDepartmentError, StaffDentalRosterError } from "@/lib/staff-dental.service";

export const dynamic = "force-dynamic";
export async function GET() {
  const headers = {"Cache-Control":"no-store"};
  try { return NextResponse.json({departments:await getStaffDentalDepartments()},{headers}); }
  catch { return NextResponse.json({error:"โหลดรายชื่อแผนกรับบริการไม่สำเร็จ"},{status:500,headers}); }
}
export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  let input;
  try {
    const text = await req.text();
    if (text.length > 4096) return NextResponse.json({ error: "ข้อมูลรายงานใหญ่เกินไป" }, { status: 413, headers });
    input = parseStaffDentalFilters(JSON.parse(text));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ข้อมูลรายงานไม่ถูกต้อง" }, { status: 400, headers });
  }
  try { return NextResponse.json(await getStaffDentalReport(input), { headers }); }
  catch (error) {
    if(error instanceof StaffDentalDepartmentError) return NextResponse.json({error:error.message},{status:400,headers});
    if(error instanceof StaffDentalRosterError) return NextResponse.json({error:error.message},{status:503,headers});
    // Do not log SQL/error objects that may include patient identifiers.
    console.error("Staff dental report query failed");
    return NextResponse.json({ error: "ดึงข้อมูลทันตกรรมจาก HOSxP ไม่สำเร็จ กรุณาลองใหม่หรือติดต่อ IT" }, { status: 500, headers });
  }
}
