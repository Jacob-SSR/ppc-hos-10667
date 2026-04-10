import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET as string);

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
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
  ],
};
