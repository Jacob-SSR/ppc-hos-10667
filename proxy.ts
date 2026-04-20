import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET as string);

// เส้นทางที่ guest เข้าได้โดยไม่ต้อง login
const GUEST_ALLOWED_PATHS = [
  "/pages/dashboard",
  "/api/dashboard", // ครอบ /api/dashboard, /api/dashboard/monthly, /api/dashboard/patients
  "/api/ipd/summary",
  "/api/ipd/bed-occupancy",
  "/api/ipd/discharge",
  "/api/ppa/aging",
  "/api/ppa/ncd01",
  "/api/ppa/mch01",
  "/api/ppa/mch02",
  "/api/me",
];

function isGuestAllowed(pathname: string): boolean {
  return GUEST_ALLOWED_PATHS.some(
    (p) =>
      pathname === p ||
      pathname.startsWith(p + "/") ||
      pathname.startsWith(p + "?"),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;

  // ไม่มี token
  if (!token) {
    if (isGuestAllowed(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // มี token → verify
  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // token เสีย — ถ้าเป็น path ที่ guest เข้าได้ ก็ให้ผ่าน (พร้อมล้าง cookie)
    if (isGuestAllowed(pathname)) {
      const res = NextResponse.next();
      res.cookies.set("token", "", {
        httpOnly: true,
        expires: new Date(0),
        path: "/",
      });
      return res;
    }
    const response = NextResponse.redirect(new URL("/auth/login", request.url));
    response.cookies.set("token", "", {
      httpOnly: true,
      expires: new Date(0),
      path: "/",
    });
    return response;
  }
}

export const config = {
  matcher: [
    "/pages/:path*",
    "/api/report/:path*",
    "/api/no-endpoint/:path*",
    "/api/uc-outside/:path*",
    "/api/uc-outside-dental/:path*",
    "/api/dashboard/:path*",
    "/api/service-unit/:path*",
    "/api/ppa/:path*",
    "/api/ipd/:path*",
    "/api/death-not-discharged/:path*",
    "/api/me",
  ],
};
