// lib/cache.ts
import { redis } from "./redis";

interface Envelope<T> {
  v: T; // ค่า data จริง
  softExp: number; // epoch ms — เลยเวลานี้ = ควร refresh (แต่ยังแจก stale ได้)
}

const STALE_GRACE = 4; // hard TTL = ttl * STALE_GRACE → มีของเก่าเหลือแจกอีก 3 เท่าของ ttl
const LOCK_TTL_MS = 30_000; // กัน lock ค้างถ้า process ตายกลาง query (query dashboard ไม่ควรเกิน 30s)
const COLD_WAIT_MS = 150; // cache ว่างเปล่า + แย่ง lock ไม่ทัน → รอ poll ทีละเท่านี้
const COLD_WAIT_ROUNDS = 20; // รวมสูงสุด ~3s แล้วค่อยยอม query ตรง

export async function cachedQuery<T>(
  keyParts: (string | number)[],
  fn: () => Promise<T>,
  ttl: number = 600,
): Promise<T> {
  const key = `ppc:${keyParts.join(":")}`;
  const lockKey = `${key}:lock`;

  // ── 1) อ่าน cache ──────────────────────────────────────────────────────────
  let stale: Envelope<T> | null = null;
  try {
    const raw = await redis.get(key);
    if (raw) {
      const env = JSON.parse(raw) as Envelope<T>;
      // key รูปแบบเก่า (ก่อนมี envelope) จะไม่มี softExp → ถือเป็น miss ให้ query ใหม่
      if (typeof env?.softExp === "number") {
        if (Date.now() < env.softExp) return env.v; // ยังสด → จบเลย
        stale = env; // หมดอายุแบบ soft → เก็บไว้เป็นตัวสำรอง
      }
    }
  } catch {
    // Redis ล่ม → query ตรง
    return fn();
  }

  // ── 2) แย่ง lock เพื่อเป็นคน refresh ──────────────────────────────────────
  let gotLock = false;
  try {
    gotLock = (await redis.set(lockKey, "1", "PX", LOCK_TTL_MS, "NX")) === "OK";
  } catch {
    return stale ? stale.v : fn();
  }

  if (gotLock) {
    try {
      const data = await fn();
      await writeCache(key, data, ttl);
      return data;
    } catch (err) {
      // query พัง: ถ้ามี stale ก็แจก stale ไปก่อน ดีกว่าโยน 500 ใส่ทุกคน
      if (stale) return stale.v;
      throw err;
    } finally {
      redis.del(lockKey).catch(() => {});
    }
  }

  // ── 3) ไม่ได้ lock = มีคนอื่นกำลัง refresh อยู่ ────────────────────────────
  if (stale) return stale.v; // มีของเก่า → แจกไปก่อน รอบหน้าได้ของใหม่เอง

  // cold start (ไม่มีของเก่าเลย เช่น Redis เพิ่งเคลียร์): รอให้คนถือ lock ทำเสร็จ
  for (let i = 0; i < COLD_WAIT_ROUNDS; i++) {
    await sleep(COLD_WAIT_MS);
    try {
      const raw = await redis.get(key);
      if (raw) return (JSON.parse(raw) as Envelope<T>).v;
    } catch {
      break;
    }
  }
  // รอนานเกิน → ยอม query ตรง (โดน DB บ้างดีกว่าผู้ใช้ค้าง)
  return fn();
}

async function writeCache<T>(key: string, data: T, ttl: number) {
  try {
    const env: Envelope<T> = { v: data, softExp: Date.now() + ttl * 1000 };
    await redis.set(key, JSON.stringify(env), "EX", ttl * STALE_GRACE);
  } catch {
    // เขียนไม่ได้ก็ข้าม
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── invalidate: เปลี่ยนจาก KEYS (block ทั้ง Redis) เป็น SCAN ─────────────────
export async function invalidate(prefix: string) {
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        `ppc:${prefix}*`,
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
