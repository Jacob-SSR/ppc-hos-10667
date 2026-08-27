// lib/httpCache.ts
// ─────────────────────────────────────────────────────────────────────────────
// ชั้น HTTP cache ของ API: ETag + 304 + Cache-Control + gzip
//
// ทำไมต้องมี:
//   เดิมทุก request (รวมทั้ง browser ที่กด refresh และ dashboard ที่ poll ทุก 30 วิ)
//   วิ่งถึง Node เสมอ แล้ว Node ก็ JSON.stringify payload ก้อนเดิมใหม่ทุกครั้ง
//   ทั้งที่ข้อมูลไม่เปลี่ยนเลยตลอด TTL
//
// หลังจากนี้:
//   - ตอบ ETag ทุกครั้ง → รอบถัดไป browser ส่ง If-None-Match มา เราตอบ 304 ตัวเปล่า
//     (ประหยัด bandwidth เกือบทั้งหมดของ payload map/dashboard ที่ใหญ่หลาย MB)
//   - Cache-Control: private, max-age → browser ไม่ยิงซ้ำเลยในช่วงสั้นๆ
//   - gzip: บีบครั้งเดียวตอน cache miss แล้วเก็บ buffer ไว้ (ดู cachedJson ใน lib/cache.ts)
//
// หมายเหตุ: ใช้ private เสมอ เพราะข้อมูลเป็นของโรงพยาบาลและบาง endpoint
// ผันตามสิทธิ์ผู้ใช้ — ห้าม cache ที่ proxy/CDN ที่แชร์กันหลายคน
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

/** payload ที่เข้ารหัสแล้ว — เก็บลง Redis ได้ตรงๆ ไม่ต้อง stringify ซ้ำ */
export interface EncodedPayload {
  body: Buffer; // เนื้อ response (gzip แล้วถ้า gzipped = true)
  etag: string; // ETag ของ "เนื้อข้อมูลดิบ" (ไม่ผูกกับ encoding)
  gzipped: boolean;
  bytes: number; // ขนาดดิบก่อนบีบ — ไว้ log/ดู
}

/** บีบเล็กกว่านี้ไม่คุ้ม CPU (header gzip เองก็กินไปหลายสิบ byte) */
const GZIP_MIN_BYTES = 1024;

/** แปลง data → payload พร้อมส่ง (stringify + hash + gzip ครั้งเดียวจบ) */
export function encodePayload(data: unknown): EncodedPayload {
  const json = JSON.stringify(data ?? null);
  const raw = Buffer.from(json, "utf8");
  const etag = `"${createHash("sha1").update(raw).digest("base64url")}"`;

  if (raw.byteLength < GZIP_MIN_BYTES) {
    return { body: raw, etag, gzipped: false, bytes: raw.byteLength };
  }
  // level 6 = จุดคุ้มทุนระหว่างเวลาบีบกับขนาด (ทำแค่ตอน cache miss จึงไม่กระทบ latency ปกติ)
  const gz = gzipSync(raw, { level: 6 });
  return { body: gz, etag, gzipped: true, bytes: raw.byteLength };
}

export interface CacheHeaderOptions {
  /** วินาทีที่ browser ใช้ของเดิมได้โดยไม่ต้องถามเซิร์ฟเวอร์เลย */
  maxAge?: number;
  /** วินาทีที่ browser ใช้ของเก่าไปพลางแล้วค่อย revalidate เบื้องหลัง */
  staleWhileRevalidate?: number;
}

function cacheControl(opts: CacheHeaderOptions): string {
  const maxAge = Math.max(0, Math.floor(opts.maxAge ?? 30));
  const swr = Math.max(0, Math.floor(opts.staleWhileRevalidate ?? maxAge * 10));
  return `private, max-age=${maxAge}, stale-while-revalidate=${swr}`;
}

function clientAcceptsGzip(req: Request): boolean {
  return (req.headers.get("accept-encoding") ?? "").includes("gzip");
}

/** browser ส่ง If-None-Match มาตรงกับของที่เรามีหรือไม่ (รองรับหลายค่าและ W/ prefix) */
function etagMatches(req: Request, etag: string): boolean {
  const inm = req.headers.get("if-none-match");
  if (!inm) return false;
  const bare = etag.replace(/^W\//, "");
  return inm
    .split(",")
    .some((t) => t.trim().replace(/^W\//, "") === bare || t.trim() === "*");
}

/** สร้าง Response จาก payload ที่เข้ารหัสไว้แล้ว — ตอบ 304 ถ้า ETag ตรง */
export function payloadResponse(
  req: Request,
  payload: EncodedPayload,
  opts: CacheHeaderOptions = {},
): Response {
  const headers = new Headers({
    "Cache-Control": cacheControl(opts),
    ETag: payload.etag,
    Vary: "Accept-Encoding, Cookie",
  });

  // ── 304: ของในเครื่อง browser ยังตรงอยู่ ไม่ต้องส่ง body เลย ──
  if (etagMatches(req, payload.etag)) {
    return new Response(null, { status: 304, headers });
  }

  headers.set("Content-Type", "application/json; charset=utf-8");

  // client ไม่รับ gzip (หายากมาก เช่น curl เปล่าๆ) → คลายให้ก่อนส่ง
  let body = payload.body;
  if (payload.gzipped) {
    if (clientAcceptsGzip(req)) {
      headers.set("Content-Encoding", "gzip");
    } else {
      body = gunzipSync(payload.body);
    }
  }
  headers.set("Content-Length", String(body.byteLength));

  // Buffer → Uint8Array ธรรมดา (BodyInit ของ Web Response)
  return new Response(new Uint8Array(body), { status: 200, headers });
}

/**
 * ตอบ JSON พร้อม ETag/Cache-Control สำหรับ route ที่ประกอบ payload เองรายครั้ง
 * (เช่นแปะ start/end ของผู้ใช้เข้าไปในผลลัพธ์) — ไม่ได้ cache body ไว้ใน Redis
 * แต่ยังได้ 304 + ประหยัด bandwidth เต็มๆ
 */
export function jsonCached(
  req: Request,
  data: unknown,
  opts: CacheHeaderOptions = {},
): Response {
  return payloadResponse(req, encodePayload(data), opts);
}
