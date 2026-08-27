import mysql from "mysql2/promise";

const requiredEnv = [
  "DB_HOST",
  "DB_HOST2",
  "DB_PORT",
  "DB_USER",
  "DB_PASS",
  "DB_NAME",
  "JWT_SECRET",
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

// ── config ร่วมของทั้งสอง pool (db / db2) ──────────────────────────────────────
// แยกเฉพาะ host ออกไป ที่เหลือใช้ชุดเดียวกัน กัน config เพี้ยนระหว่าง pool
const sharedConfig = {
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  charset: "tis620", // HOSxP ใช้ tis620 — อย่าเปลี่ยน

  // ⚠️ ความปลอดภัย: ห้ามตั้งเป็น true เด็ดขาด
  //    multipleStatements: true จะอนุญาตให้ยิงหลาย statement ในครั้งเดียว
  //    (เช่น "SELECT ...; DROP TABLE ...") = เปิดทาง stacked-query SQL injection
  //    default ของ mysql2 คือ false อยู่แล้ว แต่เขียนไว้ชัดเพื่อกันคนเผลอเปิดทีหลัง
  multipleStatements: false,

  // ── ขนาด pool: ตั้งให้ชัด ห้ามพึ่ง default ─────────────────────────────────
  // ทำไมสำคัญ: lib/cache.ts มีทางลัด "Redis ล่ม / รอ lock นานเกิน → query ตรง"
  // ถ้า pool ไม่จำกัดคิว ตอน Redis สะดุดพร้อมกันหลายคน request จะไหลเข้า HosXP
  // ทีเดียวเป็นร้อย = ล้ม DB ตัวจริงของโรงพยาบาลไปด้วย
  // จำกัดไว้แล้ว "ยอมช้า" ดีกว่า "พาระบบงานล่ม"
  connectionLimit: Number(process.env.DB_POOL_SIZE ?? 12),
  maxIdle: Number(process.env.DB_POOL_IDLE ?? 6), // ปล่อย connection ส่วนเกินคืนตอนว่าง
  idleTimeout: 60_000,
  waitForConnections: true, // pool เต็ม → เข้าคิว (ไม่ใช่ throw ทันที)
  queueLimit: Number(process.env.DB_QUEUE_LIMIT ?? 200), // คิวยาวเกินนี้ = ตอบ error เลย ดีกว่าค้างยาว
  connectTimeout: 10_000,
  enableKeepAlive: true, // กัน connection ตายเงียบเวลาข้าม LAN/NAT
  keepAliveInitialDelay: 30_000,
} as const;

export const db = mysql.createPool({
  host: process.env.DB_HOST,
  ...sharedConfig,
});

export const db2 = mysql.createPool({
  host: process.env.DB_HOST2,
  ...sharedConfig,
});

// semaphore สำหรับ query หนัก — ตัวจริงอยู่ใน lib/limiter.ts (ไม่มี dependency)
// re-export ไว้ให้ import จากที่เดียวกับ pool ได้
export { withHeavySlot as withHeavyQuerySlot } from "./limiter";
