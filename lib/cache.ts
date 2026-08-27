// lib/cache.ts
import { redis } from "./redis";
import { withHeavySlot } from "./limiter";
import {
  encodePayload,
  payloadResponse,
  type CacheHeaderOptions,
  type EncodedPayload,
} from "./httpCache";

const STALE_GRACE = 4; // hard TTL = ttl * STALE_GRACE → มีของเก่าเหลือแจกอีก 3 เท่าของ ttl
const LOCK_TTL_MS = 30_000; // กัน lock ค้างถ้า process ตายกลาง query (query dashboard ไม่ควรเกิน 30s)
const COLD_WAIT_MS = 150; // cache ว่างเปล่า + แย่ง lock ไม่ทัน → รอ poll ทีละเท่านี้
const COLD_WAIT_ROUNDS = 20; // รวมสูงสุด ~3s แล้วค่อยยอม query ตรง

// ─────────────────────────────────────────────────────────────────────────────
// แกนกลาง SWR + stampede lock — ใช้ร่วมกันทั้ง cachedQuery (เก็บ object)
// และ cachedJson (เก็บ payload ที่ gzip แล้ว) ต่างกันแค่วิธี อ่าน/เขียน Redis
// ─────────────────────────────────────────────────────────────────────────────
interface Store<C> {
  /** null = ไม่มีของใน cache, softExp = epoch ms ที่ถือว่า "ควร refresh แล้ว" */
  read: () => Promise<{ value: C; softExp: number } | null>;
  write: (value: C, ttl: number) => Promise<void>;
}

async function swr<C>(
  key: string,
  build: () => Promise<C>,
  store: Store<C>,
  ttl: number,
): Promise<C> {
  const lockKey = `${key}:lock`;
  // ทุกทางที่ต้องลงไปดึงข้อมูลจริง (cache miss / Redis ล่ม / รอ lock นานเกิน)
  // ผ่าน semaphore เสมอ — กันไม่ให้ของหนักไหลเข้า HosXP พร้อมกันเป็นร้อย
  const produce = () => withHeavySlot(build);

  // ── 1) อ่าน cache ──────────────────────────────────────────────────────────
  let stale: C | null = null;
  try {
    const hit = await store.read();
    if (hit) {
      if (Date.now() < hit.softExp) return hit.value; // ยังสด → จบเลย
      stale = hit.value; // หมดอายุแบบ soft → เก็บไว้เป็นตัวสำรอง
    }
  } catch {
    // Redis ล่ม → query ตรง
    return produce();
  }

  // ── 2) แย่ง lock เพื่อเป็นคน refresh ──────────────────────────────────────
  let gotLock = false;
  try {
    gotLock = (await redis.set(lockKey, "1", "PX", LOCK_TTL_MS, "NX")) === "OK";
  } catch {
    return stale ?? produce();
  }

  if (gotLock) {
    try {
      const value = await produce();
      await store.write(value, ttl);
      return value;
    } catch (err) {
      // query พัง: ถ้ามี stale ก็แจก stale ไปก่อน ดีกว่าโยน 500 ใส่ทุกคน
      if (stale !== null) return stale;
      throw err;
    } finally {
      redis.del(lockKey).catch(() => {});
    }
  }

  // ── 3) ไม่ได้ lock = มีคนอื่นกำลัง refresh อยู่ ────────────────────────────
  if (stale !== null) return stale; // มีของเก่า → แจกไปก่อน รอบหน้าได้ของใหม่เอง

  // cold start (ไม่มีของเก่าเลย เช่น Redis เพิ่งเคลียร์): รอให้คนถือ lock ทำเสร็จ
  for (let i = 0; i < COLD_WAIT_ROUNDS; i++) {
    await sleep(COLD_WAIT_MS);
    try {
      const hit = await store.read();
      if (hit) return hit.value;
    } catch {
      break;
    }
  }
  // รอนานเกิน → ยอม query ตรง (โดน DB บ้างดีกว่าผู้ใช้ค้าง)
  return produce();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) cachedQuery — คืน object ธรรมดา (ใช้กับข้อมูลที่ต้องเอาไปประมวลผลต่อ
//    เช่น ดัชนีพิกัดที่ route หลายตัวใช้ร่วมกัน)
// ─────────────────────────────────────────────────────────────────────────────
interface Envelope<T> {
  v: T; // ค่า data จริง
  softExp: number; // epoch ms — เลยเวลานี้ = ควร refresh (แต่ยังแจก stale ได้)
}

function jsonStore<T>(key: string): Store<T> {
  return {
    async read() {
      const raw = await redis.get(key);
      if (!raw) return null;
      const env = JSON.parse(raw) as Envelope<T>;
      // key รูปแบบเก่า (ก่อนมี envelope) จะไม่มี softExp → ถือเป็น miss ให้ query ใหม่
      if (typeof env?.softExp !== "number") return null;
      return { value: env.v, softExp: env.softExp };
    },
    async write(value, ttl) {
      try {
        const env: Envelope<T> = { v: value, softExp: Date.now() + ttl * 1000 };
        await redis.set(key, JSON.stringify(env), "EX", ttl * STALE_GRACE);
      } catch {
        // เขียนไม่ได้ก็ข้าม
      }
    },
  };
}

export async function cachedQuery<T>(
  keyParts: (string | number)[],
  fn: () => Promise<T>,
  ttl: number = 600,
): Promise<T> {
  const key = `ppc:${keyParts.join(":")}`;
  return swr(key, fn, jsonStore<T>(key), ttl);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) cachedJson — เก็บ "ตัว response ที่ gzip แล้ว" ลง Redis
//
//    เดิม: ทุก cache hit ทำ JSON.parse (จาก Redis) → NextResponse.json (stringify กลับ)
//          payload map/dashboard หลาย MB จึงเผา CPU ซ้ำๆ ทั้งที่ผลลัพธ์เหมือนเดิมเป๊ะ
//    ใหม่: stringify + hash (ETag) + gzip ครั้งเดียวตอน cache miss แล้วส่ง buffer
//          ก้อนเดิมออกไปตรงๆ ทุก hit — CPU ต่อ request แทบเป็นศูนย์
//
//    เก็บเป็น Redis hash: b = body(gzip), e = ETag, z = gzip flag, n = ขนาดดิบ, s = softExp
// ─────────────────────────────────────────────────────────────────────────────
function payloadStore(key: string): Store<EncodedPayload> {
  return {
    async read() {
      const h = await redis.hgetallBuffer(key);
      if (!h || !h.b || !h.s) return null;
      const softExp = Number(h.s.toString());
      if (!Number.isFinite(softExp)) return null;
      return {
        value: {
          body: h.b,
          etag: h.e?.toString() ?? "",
          gzipped: h.z?.toString() === "1",
          bytes: Number(h.n?.toString() ?? h.b.byteLength),
        },
        softExp,
      };
    },
    async write(payload, ttl) {
      try {
        await redis
          .multi()
          .hset(key, {
            b: payload.body,
            e: payload.etag,
            z: payload.gzipped ? "1" : "0",
            n: String(payload.bytes),
            s: String(Date.now() + ttl * 1000),
          })
          .pexpire(key, ttl * STALE_GRACE * 1000)
          .exec();
      } catch {
        // เขียนไม่ได้ก็ข้าม
      }
    },
  };
}

export interface CachedJsonOptions extends CacheHeaderOptions {
  /** แปลงข้อมูลก่อนส่ง (เช่นแปะ meta ของ request) — ทำให้ body cache ใช้ไม่ได้ */
  ttl?: number;
}

/**
 * ทางลัดสำหรับ GET route: cache → gzip → ETag → 304 ครบในบรรทัดเดียว
 *
 *   export async function GET(req: Request) {
 *     return cachedJson(req, ["tb-map"], buildTBMapData, 900);
 *   }
 *
 * maxAge ที่ไม่ระบุ = 1/10 ของ ttl (อย่างน้อย 15s สูงสุด 120s) — ช่วงที่ browser
 * ไม่ต้องถามเซิร์ฟเวอร์เลย สั้นพอที่ข้อมูลจะไม่เก่าเกินกว่ารอบ warm ของ cache
 */
export async function cachedJson<T>(
  req: Request,
  keyParts: (string | number)[],
  fn: () => Promise<T>,
  ttl: number = 600,
  opts: CacheHeaderOptions = {},
): Promise<Response> {
  const key = `ppc:p:${keyParts.join(":")}`;
  const payload = await swr(
    key,
    async () => encodePayload(await fn()),
    payloadStore(key),
    ttl,
  );
  return payloadResponse(req, payload, {
    maxAge: opts.maxAge ?? defaultMaxAge(ttl),
    staleWhileRevalidate: opts.staleWhileRevalidate ?? ttl * STALE_GRACE,
  });
}

export function defaultMaxAge(ttl: number): number {
  return Math.min(120, Math.max(15, Math.round(ttl / 10)));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── invalidate: เปลี่ยนจาก KEYS (block ทั้ง Redis) เป็น SCAN ─────────────────
// ล้างทั้ง key ของ cachedQuery (ppc:<prefix>) และของ cachedJson (ppc:p:<prefix>)
export async function invalidate(prefix: string) {
  await Promise.all([scanDel(`ppc:${prefix}*`), scanDel(`ppc:p:${prefix}*`)]);
}

async function scanDel(match: string) {
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        match,
        "COUNT",
        200,
      );
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch {
    // Redis ล่มก็ข้าม — cache จะหมดอายุเองตาม TTL
  }
}
