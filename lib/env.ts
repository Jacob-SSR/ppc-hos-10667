// lib/env.ts
// ตรวจ environment variable ที่จำเป็นทั้งหมด "ครั้งเดียวตอน startup"
// เรียกจาก instrumentation.ts (ดูไฟล์ instrumentation.ts) เพื่อ fail fast
//
// แยกเป็น 2 กลุ่ม:
//   REQUIRED  = ขาดแล้วแอปทำงานไม่ได้เลย → throw
//   OPTIONAL  = ขาดแล้วเฉพาะบางฟีเจอร์ใช้ไม่ได้ (AI/Sheets) → warn เฉยๆ ไม่ throw
//
// ปรับ required/optional ตามว่าฟีเจอร์ไหน "ต้องมี" จริงในแต่ละ deploy

const REQUIRED_ENV = [
  "DB_HOST",
  "DB_HOST2",
  "DB_PORT",
  "DB_USER",
  "DB_PASS",
  "DB_NAME",
  "JWT_SECRET",
] as const;

// ฟีเจอร์เสริม — เตือนถ้าขาด แต่ไม่ล้มแอป
const OPTIONAL_ENV = [
  "GEMINI_API_KEY", // AI chat/summarize
  "GOOGLE_PRIVATE_KEY", // Google Sheets
  "GOOGLE_SERVICE_ACCOUNT_EMAIL", // Google Sheets
  "GOOGLE_SHEET_ID", // Google Sheets
  "SYNC_SECRET", // cron sync → Google Sheets (ไม่ตั้ง = ปิดช่องทาง cron, manual ผ่าน login ยังใช้ได้)
] as const;

export function validateEnv(): void {
  const missingRequired = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missingRequired.length > 0) {
    throw new Error(
      `[env] ขาด environment variable ที่จำเป็น: ${missingRequired.join(", ")}`,
    );
  }

  // JWT_SECRET อ่อน = ปลอม token เข้าได้ทุกบัญชี
  // production: ไม่ยอมให้ start เลย / dev: เตือนอย่างเดียว
  if ((process.env.JWT_SECRET ?? "").length < 32) {
    const msg =
      "[env] JWT_SECRET สั้นกว่า 32 ตัวอักษร — ต้องยาวและสุ่ม (สร้างด้วย: openssl rand -base64 48)";
    if (process.env.NODE_ENV === "production") throw new Error(msg);
    console.warn(`⚠️  ${msg} (dev: เตือนอย่างเดียว)`);
  }

  // ค่า NEXT_PUBLIC_* ถูก inline เข้า JS bundle ที่ browser โหลดได้ = ไม่ใช่ความลับ
  // เคยมี NEXT_PUBLIC_SYNC_SECRET หลุดแบบนี้มาแล้ว → บล็อกไว้เลยกันพลาดซ้ำ
  if (process.env.NEXT_PUBLIC_SYNC_SECRET) {
    throw new Error(
      "[env] ห้ามตั้ง NEXT_PUBLIC_SYNC_SECRET — secret ที่ขึ้นต้น NEXT_PUBLIC_ จะหลุดไปอยู่ในโค้ดฝั่ง browser ให้ใช้ SYNC_SECRET (server เท่านั้น) แทน แล้วลบตัวนี้ออกจาก .env",
    );
  }

  const missingOptional = OPTIONAL_ENV.filter((k) => !process.env[k]);
  if (missingOptional.length > 0) {
    console.warn(
      `[env] ⚠️  ขาด env ของฟีเจอร์เสริม (ฟีเจอร์ที่เกี่ยวข้องจะใช้ไม่ได้): ${missingOptional.join(", ")}`,
    );
  }

  // ตรวจรูปแบบเฉพาะที่เคยพังบ่อย: GOOGLE_PRIVATE_KEY ต้องมี \n (escaped)
  const pk = process.env.GOOGLE_PRIVATE_KEY;
  if (pk && !pk.includes("\\n") && !pk.includes("\n")) {
    console.warn(
      "[env] ⚠️  GOOGLE_PRIVATE_KEY ดูเหมือนไม่มี newline — Google auth อาจล้มเหลว",
    );
  }
}
