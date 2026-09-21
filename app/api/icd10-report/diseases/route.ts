import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db, withHeavyQuerySlot } from "@/lib/db";
import { diseaseSearchQuery, ICD_SEARCH_LIMIT, type IcdDisease } from "@/lib/icd-disease-search";

export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  let query;
  try { query = diseaseSearchQuery(req.nextUrl.searchParams.get("q") ?? ""); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "คำค้นไม่ถูกต้อง" }, { status: 400, headers }); }
  try {
    const [rows] = await withHeavyQuerySlot(() => db.query<(IcdDisease & RowDataPacket)[]>({ sql: query.sql, timeout: 10000 }, query.values));
    return NextResponse.json({ items: rows.slice(0, ICD_SEARCH_LIMIT), hasMore: rows.length > ICD_SEARCH_LIMIT }, { headers });
  } catch {
    return NextResponse.json({ error: "ค้นหาชื่อโรคไม่สำเร็จ กรุณาลองใหม่" }, { status: 500, headers });
  }
}
