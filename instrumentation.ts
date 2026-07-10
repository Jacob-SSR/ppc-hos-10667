export async function register() {
  // รันเฉพาะฝั่ง server (ไม่ใช่ edge/browser)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();

    // cache warmer: อุ่น endpoint หนักๆ ก่อน TTL หมด — ปิดได้ด้วย CACHE_WARMER=0
    const { startCacheWarmer } = await import("@/lib/cacheWarmer");
    startCacheWarmer();
  }
}
