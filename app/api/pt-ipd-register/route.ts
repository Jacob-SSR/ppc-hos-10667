// app/api/pt-ipd-register/route.ts
// รายงาน "ทะเบียนผู้ป่วยในสำหรับงานกายภาพ"
//
// query params (ทุกตัวเป็น optional):
//   start, end : ช่วงวันที่ (YYYY-MM-DD) — default = ปีงบประมาณปัจจุบัน
//   category   : หมวดรายละเอียดการให้บริการ คั่นด้วย , (เช่น chest,ambulation)
//                — default = ทุกหมวด
//
// หน้าเว็บดึงข้อมูลทั้งช่วงมาครั้งเดียวแล้วกรองหมวดหมู่ฝั่ง client (สลับ filter ได้ทันที)
// ส่วน param category มีไว้ให้คนที่เรียก API ตรง ๆ ดึงเฉพาะหมวดที่สนใจได้
import { NextResponse } from "next/server";
import {
  getPtIpdRegister,
  defaultFiscalRange,
  PT_SERVICE_BY_KEY,
} from "@/lib/ptIpdRegister.service";
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

/** "chest, ambulation" → ["chest","ambulation"] (เอาเฉพาะ key ที่มีจริงในทะเบียนหมวด) */
function parseCategories(raw: string | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => PT_SERVICE_BY_KEY.has(s)),
    ),
  ];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const def = defaultFiscalRange();
    let start = safeDate(searchParams.get("start"), def.start);
    let end = safeDate(searchParams.get("end"), def.end);
    if (start > end) [start, end] = [end, start]; // สลับมาผิดลำดับ → จัดให้ ไม่ต้องตอบ error
    const categories = parseCategories(searchParams.get("category"));

    const data = await cachedQuery(
      ["pt-ipd-register", start, end, categories.join("|")],
      () => getPtIpdRegister(start, end, categories),
      TTL_SECONDS,
    );

    return jsonCached(req, data, { maxAge: defaultMaxAge(TTL_SECONDS) });
  } catch (error) {
    console.error("PtIpdRegister API error:", error);
    return NextResponse.json(
      {
        error:
          "ดึงข้อมูลทะเบียนผู้ป่วยในงานกายภาพไม่สำเร็จ: " +
          (error as Error).message,
      },
      { status: 500 },
    );
  }
}
