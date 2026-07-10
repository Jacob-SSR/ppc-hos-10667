// lib/cacheWarmer.ts
// Cache warmer: ยิง endpoint ตัวเอง (localhost) ก่อน cache หมดอายุ
// → cache ร้อนตลอดเวลา ผู้ใช้ไม่เคยเป็นคน trigger query หนักบน HosXP เอง
//   โหลดบน DB จึงเป็น "ค่าคงที่ต่อรอบ" ไม่โตตามจำนวนผู้ใช้
//
// ทำงานร่วมกับ stampede lock ใน lib/cache.ts:
// - รันหลาย replica ได้เลย — ทุก replica ยิง HTTP เหมือนกัน แต่ replica เดียว
//   ที่คว้า lock ได้จะ query DB จริง ที่เหลือได้ค่า stale/fresh จาก Redis (ถูกมาก)
// - route ที่รับ query param ผันตามผู้ใช้ (เช่น servicetime) ไม่อยู่ในลิสต์นี้
//   เพราะ cache key แตกตาม param — warm ล่วงหน้าไม่คุ้ม
//
// ปิดได้ด้วย env: CACHE_WARMER=0

interface WarmTarget {
  path: string; // endpoint ที่จะยิง
  everySec: number; // รอบ warm — ตั้ง ~80% ของ soft TTL ของ route นั้น
}

// everySec อิง TTL จริงในแต่ละ route (ณ ก.ค. 2026) — ถ้าแก้ TTL ใน route อย่าลืมมาปรับตรงนี้
const TARGETS: WarmTarget[] = [
  // แผนที่ครัวเรือน — TTL 900
  { path: "/api/tb-map", everySec: 720 },
  { path: "/api/drug-map", everySec: 720 },
  { path: "/api/homeward-map", everySec: 720 },
  { path: "/api/minithan-map", everySec: 720 },
  { path: "/api/anc-anemia-map", everySec: 720 },
  // dashboard ใหญ่ — TTL 900
  { path: "/api/billing-dashboard", everySec: 720 },
  { path: "/api/rdu-dashboard", everySec: 720 },
  { path: "/api/dmtb-dashboard", everySec: 720 },
  { path: "/api/ktb-dashboard", everySec: 720 },
  // ใกล้ realtime — TTL 300
  { path: "/api/stm-dashboard", everySec: 240 },
  { path: "/api/acs-sheets", everySec: 240 },
  // TTL 600
  { path: "/api/sepsis-sheets", everySec: 480 },
  // TTL 180
  { path: "/api/ipd/ward-census", everySec: 150 },
];

const BASE_URL = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const STARTUP_DELAY_MS = 20_000; // รอ server พร้อมก่อนค่อยเริ่ม
const FETCH_TIMEOUT_MS = 120_000; // query dashboard บางตัวช้า ให้เวลาเยอะหน่อย

let started = false;

export function startCacheWarmer() {
  if (started) return; // กัน register ซ้ำ (hot reload ตอน dev)
  if (process.env.CACHE_WARMER === "0") {
    console.log("[warmer] ปิดอยู่ (CACHE_WARMER=0)");
    return;
  }
  started = true;

  setTimeout(() => {
    console.log(`[warmer] เริ่มทำงาน ${TARGETS.length} endpoints`);
    for (const t of TARGETS) {
      // jitter 0–15s ต่อ target กันยิงพร้อมกันทุกตัวจน DB pool ตันเป็นช่วงๆ
      const jitter = Math.random() * 15_000;
      setTimeout(() => {
        warm(t); // รอบแรกทันที (อุ่น cache ตั้งแต่ boot)
        setInterval(() => warm(t), t.everySec * 1000);
      }, jitter);
    }
  }, STARTUP_DELAY_MS);
}

async function warm(t: WarmTarget) {
  const startedAt = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${t.path}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // key ให้ proxy.ts ปล่อยผ่าน auth — วิ่งเฉพาะ loopback ไม่เคยออกนอกเครื่อง
        "x-warmer-key": process.env.WARMER_KEY ?? process.env.JWT_SECRET ?? "",
      },
    });
    const ms = Date.now() - startedAt;
    if (!res.ok) {
      console.warn(`[warmer] ${t.path} → HTTP ${res.status} (${ms}ms)`);
      return;
    }
    // อ่าน body ทิ้งเพื่อปิด connection ให้เรียบร้อย
    await res.arrayBuffer();
    if (ms > 10_000) console.log(`[warmer] ${t.path} ช้า ${ms}ms`);
  } catch (err) {
    console.warn(
      `[warmer] ${t.path} ล้มเหลว:`,
      err instanceof Error ? err.message : err,
    );
  }
}
