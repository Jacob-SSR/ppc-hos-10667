// lib/rateLimit.ts
// In-memory rate limiter (sliding window) สำหรับ single-instance / dev
// ⚠️ ถ้า deploy หลาย instance (Vercel serverless หลายตัว) state จะไม่ sync กัน
//    กรณีนั้นควรย้ายไป Redis (Upstash) — ดูหมายเหตุท้ายไฟล์
import { NextResponse } from "next/server";

interface Bucket {
  timestamps: number[]; // เวลาของ request ที่ผ่านมา (ms)
}

const store = new Map<string, Bucket>();

// เก็บกวาด bucket ที่หมดอายุทุก 5 นาที กัน memory โต unbounded
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

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number; // วินาทีที่ต้องรอ (0 ถ้ายังไม่ติด limit)
  limit: number;
}

/**
 * ตรวจสอบ rate limit แบบ sliding window
 * @param key   คีย์เฉพาะ (เช่น "login:1.2.3.4" หรือ "ai:username")
 * @param limit จำนวน request สูงสุดในหน้าต่างเวลา
 * @param windowMs ขนาดหน้าต่างเวลา (ms)
 */
export function rateLimit(
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

  // ตัด timestamp ที่อยู่นอกหน้าต่างออก
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
