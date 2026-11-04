import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionAccess } from "@/lib/user-access";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

// role มาตรฐานทั้งระบบใช้ "ตัวพิมพ์ใหญ่" เสมอ (USER, IT, ADMIN, GUEST)
// กันบั๊กตอนเทียบกับ ROLE_POLICIES ใน proxy / login route
const GUEST = {
  user: { username: "Guest", role: "GUEST", name: "Guest" },
};

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json(GUEST, { headers });
  }

  try {
    const user = await sessionAccess(token);
    return NextResponse.json(user ? { user } : GUEST, { headers });
  } catch {
    return NextResponse.json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" }, { status: 503, headers });
  }
}
