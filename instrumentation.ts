export async function register() {
  // รันเฉพาะฝั่ง server (ไม่ใช่ edge/browser)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
