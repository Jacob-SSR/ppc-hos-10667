import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET as string);

// เส้นทางที่ guest เข้าได้โดยไม่ต้อง login
const GUEST_ALLOWED_PATHS = [
  "/pages/dashboard",
  "/api/dashboard",
  "/api/ipd/summary",
  "/api/ipd/bed-occupancy",
  "/api/ipd/ward-summary",
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

  if (!token) {
    if (isGuestAllowed(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
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
    "/api/accident-sheets/:path*",
    "/api/ai/:path*",
    "/api/anc-nursing/:path*",
    "/api/anc-sheets/:path*",
    "/api/billing-dashboard/:path*",
    "/api/billing-upload/:path*",
    "/api/change-password/:path*",
    "/api/condom-report/:path*",
    "/api/dashboard/:path*",
    "/api/death-not-discharged/:path*",
    "/api/dental-dashboard/:path*",
    "/api/dept-status/:path*",
    "/api/dmht-new/:path*",
    "/api/dmtb-dashboard/:path*",
    "/api/drug-sheets/:path*",
    "/api/fall-report/:path*",
    "/api/high-risk-procedures/:path*",
    "/api/homeward-sheets/:path*",
    "/api/imc-sheets/:path*",
    "/api/incomplete-visit/:path*",
    "/api/ip-homeward-sheets/:path*",
    "/api/ipd/:path*",
    "/api/it-worklog-form/:path*",
    "/api/it-worklog-sheets/:path*",
    "/api/ktb-dashboard/:path*",
    "/api/ktb-upload/:path*",
    "/api/me",
    "/api/no-endpoint/:path*",
    "/api/patient-no-person/:path*",
    "/api/ppa/:path*",
    "/api/productivity-er/:path*",
    "/api/productivity-ipd/:path*",
    "/api/productivity-lr/:path*",
    "/api/productivity-opd/:path*",
    "/api/pt-dashboard/:path*",
    "/api/rabies-followup/:path*",
    "/api/rdu-dashboard/:path*",
    "/api/report/:path*",
    "/api/sepsis-sheets/:path*",
    "/api/service-unit/:path*",
    "/api/shift-stats/:path*",
    "/api/stm-dashboard/:path*",
    "/api/stroke-sheets/:path*",
    "/api/tb-dashboard/:path*",
    "/api/ttm-dashboard/:path*",
    "/api/uc-outside/:path*",
    "/api/uc-outside-dental/:path*",
    "/api/drug-2569/:path*",
  ],
};
