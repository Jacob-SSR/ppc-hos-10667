// lib/rateLimit.ts
// Rate limiter แบบ sliding window บน Redis (sorted set)
// → state แชร์กันทุก instance รัน replica กี่ตัว limit ก็เท่าเดิม
//
// Fallback: Redis ล่ม → ใช้ in-memory ของ instance นั้นไปก่อน (fail-open บางส่วน
// ดีกว่า fail-closed ที่จะบล็อกทุกคนตอน Redis มีปัญหา)
//
// ⚠️ rateLimit() เป็น async แล้ว — จุดที่เรียกต้องใส่ await

import { NextResponse } from "next/server";
import { redis } from "./redis";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number; // วินาทีที่ต้องรอ (0 ถ้ายังไม่ติด limit)
  limit: number;
}

/**
 * ตรวจสอบ rate limit แบบ sliding window (Redis sorted set)
 * @param key   คีย์เฉพาะ (เช่น "login:ip:1.2.3.4" หรือ "ai:chat:username")
 * @param limit จำนวน request สูงสุดในหน้าต่างเวลา
 * @param windowMs ขนาดหน้าต่างเวลา (ms)
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const zkey = `ppc:rl:${key}`;

  try {
    // ทำเป็น pipeline รอบเดียว: ตัดของเก่า → นับ → เพิ่มของใหม่ → ต่ออายุ key
    const pipe = redis.multi();
    pipe.zremrangebyscore(zkey, 0, now - windowMs); // ตัด timestamp นอกหน้าต่าง
    pipe.zcard(zkey); // นับที่เหลือ
    pipe.zrange(zkey, 0, 0, "WITHSCORES"); // ตัวเก่าสุด (ไว้คำนวณ retryAfter)
    const res = await pipe.exec();
    if (!res) throw new Error("pipeline failed");

    const count = res[1][1] as number;
    const oldest = (res[2][1] as string[])[1]; // score ของตัวเก่าสุด (อาจ undefined)

    if (count >= limit) {
      const retryAfterSec = oldest
        ? Math.max(1, Math.ceil((windowMs - (now - Number(oldest))) / 1000))
        : Math.ceil(windowMs / 1000);
      return { ok: false, remaining: 0, retryAfterSec, limit };
    }

    // ยังไม่เกิน → บันทึก request นี้ (member ต้อง unique กัน timestamp ชนกัน)
    await redis
      .multi()
      .zadd(zkey, now, `${now}:${Math.random().toString(36).slice(2, 8)}`)
      .pexpire(zkey, windowMs)
      .exec();

    return { ok: true, remaining: limit - count - 1, retryAfterSec: 0, limit };
  } catch {
    // Redis ล่ม → fallback in-memory ของ instance นี้
    return memoryRateLimit(key, limit, windowMs);
  }
}

// ── Fallback in-memory (โค้ดชุดเดิม) ────────────────────────────────────────
interface Bucket {
  timestamps: number[];
}
const store = new Map<string, Bucket>();
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of store.entries()) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) store.delete(key);
  }
}

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  cleanup(windowMs);
  const now = Date.now();

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    store.set(key, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000);
    return { ok: false, remaining: 0, retryAfterSec, limit };
  }

  bucket.timestamps.push(now);
  return {
    ok: true,
    remaining: limit - bucket.timestamps.length,
    retryAfterSec: 0,
    limit,
  };
}

/** ดึง client IP จาก headers (รองรับ proxy / Vercel) */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

/** สร้าง response 429 มาตรฐาน */
export function tooManyRequests(
  result: RateLimitResult,
  message = "คำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
): NextResponse {
  return NextResponse.json(
    {
      error: `${message} (${result.retryAfterSec} วินาที)`,
      retryAfter: result.retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}
