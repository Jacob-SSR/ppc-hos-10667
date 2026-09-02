// app/api/er-procedures/route.ts
// รายงาน "การทำหัตถการที่ห้อง ER"
//
// query params (ทุกตัวเป็น optional):
//   start, end : ช่วงวันที่ (YYYY-MM-DD) — default = ปีงบประมาณปัจจุบัน
//   icode      : รหัสหัตถการ คั่นด้วย , (เช่น 3140260,3140213) — default = ทุกหัตถการ
//
// หน้าเว็บดึงข้อมูลทั้งช่วงมาครั้งเดียวแล้วกรองหัตถการฝั่ง client (สลับ filter ได้ทันที)
// ส่วน param icode มีไว้ให้คนที่เรียก API ตรง ๆ ดึงเฉพาะหัตถการที่สนใจได้
import { NextResponse } from "next/server";
import { getErProcedures, defaultFiscalRange } from "@/lib/erProcedures.service";
import { cachedQuery, defaultMaxAge } from "@/lib/cache";
import { jsonCached } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

// cache 10 นาที — รายงานย้อนหลัง ไม่ต้อง realtime
// (hard TTL ใน lib/cache.ts = ttl * 4 → ยังมีของเก่าแจกต่อได้ ~40 นาทีถ้า DB มีปัญหา)
const TTL_SECONDS = 600;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** รับเฉพาะรูปแบบวันที่ที่ถูกต้อง ไม่งั้นใช้ค่า default */
const safeDate = (v: string | null, fallback: string): string =>
  v && DATE_RE.test(v) ? v : fallback;

/** "3140260, 3140213" → ["3140260","3140213"] (เอาเฉพาะรหัสที่เป็น A-Z 0-9 - _) */
function parseIcodes(raw: string | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "" && /^[A-Za-z0-9_-]{1,20}$/.test(s)),
    ),
  ].slice(0, 100);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const def = defaultFiscalRange();
    let start = safeDate(searchParams.get("start"), def.start);
    let end = safeDate(searchParams.get("end"), def.end);
    if (start > end) [start, end] = [end, start]; // สลับมาผิดลำดับ → จัดให้ ไม่ต้องตอบ error
    const icodes = parseIcodes(searchParams.get("icode"));

    const data = await cachedQuery(
      ["er-procedures", start, end, icodes.join("|")],
      () => getErProcedures(start, end, icodes),
      TTL_SECONDS,
    );

    return jsonCached(req, data, { maxAge: defaultMaxAge(TTL_SECONDS) });
  } catch (error) {
    console.error("ErProcedures API error:", error);
    return NextResponse.json(
      {
        error:
          "ดึงข้อมูลหัตถการที่ห้อง ER ไม่สำเร็จ: " + (error as Error).message,
      },
      { status: 500 },
    );
  }
}
