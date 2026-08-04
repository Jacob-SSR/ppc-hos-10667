// app/api/planfin/route.ts
// เสิร์ฟหน้า "ระบบแผนการเงิน" (Planfin/PrePlanFin) เป็น HTML เต็มหน้า
// ตั้งใจเสิร์ฟผ่าน /api/* (ไม่วางใน public/) เพราะ proxy ล็อกทุก /api ต้อง login
// → ข้อมูลแผนการเงินไม่หลุดให้คนนอกที่ไม่ได้ login เห็น
import { gunzipSync } from "zlib";
import { PLANFIN_HTML_GZ_B64 } from "./planfinHtml";

// แตกไฟล์ครั้งเดียวตอนโหลดโมดูล แล้ว reuse ทุก request
const PLANFIN_HTML = gunzipSync(
  Buffer.from(PLANFIN_HTML_GZ_B64, "base64"),
).toString("utf8");

export async function GET() {
  return new Response(PLANFIN_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
