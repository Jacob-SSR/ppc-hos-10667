import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET as string);

// ─────────────────────────────────────────────────────────────────────────────
// หลักการ: DENY BY DEFAULT
// ทุก /api/* และ /pages/* ต้อง login เสมอ ยกเว้นที่ระบุไว้ข้างล่างนี้เท่านั้น
// → สร้าง route ใหม่ไม่ต้องมาแก้ไฟล์นี้ มันถูกล็อกให้อัตโนมัติ
// (ของเดิมเป็น opt-in รายชื่อ — route ใหม่ๆ เช่น tb-map, servicetime หลุดไม่มี auth)
// ─────────────────────────────────────────────────────────────────────────────

// เปิด public จริงๆ (ไม่ต้องมี token เลย)
const PUBLIC_PATHS = ["/api/login", "/api/logout", "/api/me"];

// guest (ไม่ login) เข้าดูได้ — จอ dashboard กลางที่แขวนทีวี ฯลฯ
const GUEST_ALLOWED_PATHS = [
  "/pages/dashboard",
  "/api/dashboard",
  "/api/ipd/summary",
  "/api/ipd/bed-occupancy",
  "/api/ipd/ward-summary",
  "/api/ppa/ncd01",
  "/api/ppa/mch01",
  "/api/ppa/mch02",
];

// cache warmer ยิงจาก loopback ภายใน container พร้อม key ลับ (env เดียวกัน)
// คนนอกไม่รู้ key นี้ — และ key ไม่เคยออกนอกเครื่องเพราะ warmer คุยกับตัวเอง
const WARMER_KEY = process.env.WARMER_KEY ?? process.env.JWT_SECRET;

function matchesAny(pathname: string, list: string[]): boolean {
  return list.some(
    (p) =>
      pathname === p ||
      pathname.startsWith(p + "/") ||
      pathname.startsWith(p + "?"),
  );
}

function clearTokenCookie(res: NextResponse): NextResponse {
  res.cookies.set("token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
  return res;
}

/** ปฏิเสธ: API ตอบ 401 JSON, หน้าเว็บ redirect ไป login */
function deny(request: NextRequest, hadBadToken: boolean): NextResponse {
  const { pathname } = request.nextUrl;
  const res = pathname.startsWith("/api")
    ? NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 })
    : NextResponse.redirect(new URL("/auth/login", request.url));
  return hadBadToken ? clearTokenCookie(res) : res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1) public เสมอ
  if (matchesAny(pathname, PUBLIC_PATHS)) return NextResponse.next();

  // 2) cache warmer (loopback ภายใน + key ตรง)
  if (WARMER_KEY && request.headers.get("x-warmer-key") === WARMER_KEY) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;

  // 3) ไม่มี token → เข้าได้เฉพาะโซน guest
  if (!token) {
    if (matchesAny(pathname, GUEST_ALLOWED_PATHS)) return NextResponse.next();
    return deny(request, false);
  }

  // 4) มี token → ตรวจ
  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // token เสีย/หมดอายุ: เคลียร์ cookie แล้วปฏิบัติเหมือน guest
    if (matchesAny(pathname, GUEST_ALLOWED_PATHS)) {
      return clearTokenCookie(NextResponse.next());
    }
    return deny(request, true);
  }
}

export const config = {
  // ครอบทุก /api และ /pages — ข้อยกเว้นจัดการในโค้ดข้างบน ไม่ใช่ใน matcher
  matcher: ["/api/:path*", "/pages/:path*"],
};
