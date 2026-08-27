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

import { redis } from "./redis";

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
  // มูลค่าการใช้เวชภัณฑ์ — TTL 600, warm ปีงบปัจจุบันซึ่งเป็นค่าเริ่มต้นของหน้า
  // ต้อง warm ให้ตรง section ที่หน้าเว็บเรียกจริง (คนละ cache key กับ "ทั้งหมด")
  {
    path: "/api/drug-usage?preset=fiscal&kind=drug&section=core",
    everySec: 480,
  },
  {
    path: "/api/drug-usage?preset=fiscal&kind=drug&section=dims",
    everySec: 480,
  },
  {
    path: "/api/drug-usage?preset=fiscal&kind=herbal&section=core",
    everySec: 480,
  },
  {
    path: "/api/drug-usage?preset=fiscal&kind=lab&section=core",
    everySec: 480,
  },
  {
    path: "/api/drug-usage?preset=fiscal&kind=supply&section=core",
    everySec: 480,
  },
  {
    path: "/api/drug-usage?preset=fiscal&kind=service&section=core",
    everySec: 480,
  },
  { path: "/api/drug-usage?preset=fiscal&section=summary", everySec: 480 },
  // TTL 180
  { path: "/api/ipd/ward-census", everySec: 150 },
  // จอ dashboard กลางที่แขวนทีวี (guest เข้าได้ไม่ต้อง login) — เดิมยิง HosXP ตรง
  // ทุก request ตอนนี้มี cache แล้ว จึง warm ไว้ให้ร้อนตลอด
  { path: "/api/dashboard", everySec: 90 }, // TTL 120 (ช่วงวันที่ = เดือนปัจจุบัน = ค่า default ของหน้า)
  { path: "/api/ppa/ncd01", everySec: 480 }, // TTL 600
  { path: "/api/ppa/mch01", everySec: 480 },
  { path: "/api/ppa/mch02", everySec: 480 },
];

const BASE_URL = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const STARTUP_DELAY_MS = 20_000; // รอ server พร้อมก่อนค่อยเริ่ม
const FETCH_TIMEOUT_MS = 120_000; // query dashboard บางตัวช้า ให้เวลาเยอะหน่อย

// ── leader election ──────────────────────────────────────────────────────────
// รันหลาย replica แล้วทุกตัว warm เองเท่ากับทำงานซ้ำ N เท่า (stampede lock กัน
// query ซ้ำได้ แต่ยังเปลือง HTTP + CPU + connection ฟรีๆ)
// → ให้ replica เดียวถือ lock ใน Redis เป็น "คน warm" ตัวจริง
//   ต่ออายุ lock ทุกครึ่งหนึ่งของอายุ lock; ถ้า replica นั้นตาย lock หมดอายุเอง
//   แล้ว replica อื่นชิงเป็น leader แทนภายในไม่กี่สิบวินาที
const LEADER_KEY = "ppc:warmer:leader";
const LEADER_TTL_MS = 60_000;
const LEADER_RENEW_MS = LEADER_TTL_MS / 2;
const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

let isLeader = false;

/** ชิง/ต่ออายุสิทธิ์เป็น leader — คืน true ถ้า replica นี้เป็นคน warm */
async function claimLeadership(): Promise<boolean> {
  try {
    if (isLeader) {
      // ต่ออายุเฉพาะเมื่อ lock ยังเป็นของเราจริงๆ (กันแย่ง lock ของคนอื่นตอนเน็ตสะดุด)
      const owner = await redis.get(LEADER_KEY);
      if (owner === INSTANCE_ID) {
        await redis.pexpire(LEADER_KEY, LEADER_TTL_MS);
        return true;
      }
      isLeader = false;
    }
    const ok = await redis.set(
      LEADER_KEY,
      INSTANCE_ID,
      "PX",
      LEADER_TTL_MS,
      "NX",
    );
    isLeader = ok === "OK";
    return isLeader;
  } catch {
    // Redis ล่ม → ถือว่าตัวเองเป็น leader ไปก่อน (cache ร้อนสำคัญกว่ายิงซ้ำ)
    return true;
  }
}

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

    // ต่ออายุสิทธิ์ leader เป็นจังหวะ — replica ที่ไม่ได้เป็น leader จะข้ามการ warm
    claimLeadership();
    setInterval(claimLeadership, LEADER_RENEW_MS);

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
  // ไม่ใช่ leader → ไม่ต้องยิง อีก replica ทำให้แล้ว (cache อยู่ใน Redis ก้อนเดียวกัน)
  if (!(await claimLeadership())) return;

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
