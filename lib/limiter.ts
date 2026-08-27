// lib/limiter.ts
// ─────────────────────────────────────────────────────────────────────────────
// Semaphore จำกัดจำนวน "งานหนัก" ที่วิ่งพร้อมกันใน process เดียว
//
// ทำไมต้องมี: pool ของ mysql2 กันจำนวน connection ได้ก็จริง แต่ query dashboard
// บางตัวกิน CPU ของ HosXP เป็นสิบวินาที ปล่อยวิ่งพร้อมกันสิบกว่าตัวก็พอทำให้
// ระบบงานหน้าเคาน์เตอร์หน่วงแล้ว — และตอน Redis สะดุด lib/cache.ts มีทางลัด
// "query ตรง" ที่จะปล่อยของหนักไหลเข้า DB พร้อมกันทุก request
//
// จำกัดไว้แล้ว "ยอมช้า" ดีกว่า "พาระบบงานจริงล่ม"
// ─────────────────────────────────────────────────────────────────────────────

const HEAVY_LIMIT = Math.max(1, Number(process.env.DB_HEAVY_LIMIT ?? 6));

let running = 0;
const waiting: (() => void)[] = [];

/** รันงานหนักโดยจำกัดจำนวนพร้อมกัน — เกินโควตาแล้วเข้าคิวรอ */
export async function withHeavySlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= HEAVY_LIMIT) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** ไว้ดูสถานะใน /api/server-status หรือ log */
export function heavySlotStats() {
  return { running, waiting: waiting.length, limit: HEAVY_LIMIT };
}
