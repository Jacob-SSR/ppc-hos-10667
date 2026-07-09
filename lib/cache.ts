import { redis } from "./redis";

export async function cachedQuery<T>(
  keyParts: (string | number)[],
  fn: () => Promise<T>,
  ttl: number = 600,
): Promise<T> {
  const key = `ppc:${keyParts.join(":")}`;

  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    // Redis ล่ม → ตกไป query ตรง ไม่ให้ dashboard พัง
  }

  const data = await fn();

  try {
    await redis.set(key, JSON.stringify(data), "EX", ttl);
  } catch {
    // เขียน cache ไม่ได้ก็ข้าม
  }

  return data;
}

export async function invalidate(prefix: string) {
  try {
    const keys = await redis.keys(`ppc:${prefix}*`);
    if (keys.length) await redis.del(...keys);
  } catch {
    // Redis ล่มก็ข้าม — cache จะหมดอายุเองตาม TTL
  }
}
