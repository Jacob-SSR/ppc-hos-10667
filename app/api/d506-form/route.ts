// app/api/d506-form/route.ts
// ข้อมูลเสริมจาก HOSxP สำหรับเติม "บัตรรายงานผู้ป่วย แบบ รง.506" อัตโนมัติ
// (ทะเบียนในชีตไม่มีช่องภาวะสมรส/สัญชาติ/อาชีพ/วันตาย ฯลฯ → ดึงจาก HOSxP มาติ๊กให้)
import { NextRequest, NextResponse } from "next/server";
import { getD506FormExtra } from "@/lib/d506Form.service";

/** "24/8/2026" หรือ "24/8/2569" หรือ "2026-08-24" → "2026-08-24" */
function normalizeDate(raw: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const [d, m, y] = v.split("/").map(Number);
  if (!d || !m || !y) return "";
  const year = y > 2500 ? y - 543 : y;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // HN เป็น parameter เดียวที่ลงไปถึง SQL — บังคับรูปแบบก่อน (ใช้ prepared stmt อยู่แล้ว)
    const hn = (searchParams.get("hn") ?? "").trim();
    if (!hn || !/^[A-Za-z0-9-]{1,20}$/.test(hn)) {
      return NextResponse.json({ error: "Invalid or missing hn" }, { status: 400 });
    }
    const reportDate = normalizeDate(searchParams.get("reportDate") ?? "");

    return NextResponse.json(await getD506FormExtra(hn, reportDate));
  } catch (error) {
    console.error("D506Form API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
