import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db, withHeavyQuerySlot } from "@/lib/db";
import { ICD10_LIMIT, icdQuery, parseIcdFilters, summarizeIcd, type IcdVisit } from "@/lib/icd10-report";

export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  let filters;
  try { filters = parseIcdFilters(req.nextUrl.searchParams); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "เงื่อนไขไม่ถูกต้อง" }, { status: 400, headers }); }
  try {
    const query = icdQuery(filters);
    const [rows] = await withHeavyQuerySlot(() => db.query<(IcdVisit & RowDataPacket)[]>({ sql: query.sql, timeout: 60000 }, query.values));
    if (rows.length > ICD10_LIMIT) return NextResponse.json({ error: "ข้อมูลเกิน 100,000 ครั้ง กรุณาลดช่วงวันที่หรือช่วงรหัสโรค" }, { status: 422, headers });
    return NextResponse.json({ ...summarizeIcd(rows), meta: filters }, { headers });
  } catch {
    return NextResponse.json({ error: "โหลดรายงานไม่สำเร็จ กรุณาลองใหม่หรือลดช่วงวันที่" }, { status: 500, headers });
  }
}
