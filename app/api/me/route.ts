import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db2 } from "@/lib/db";
import { RowDataPacket } from "mysql2";

type UserRow = RowDataPacket & { user: string; name: string; role: string };

// role มาตรฐานทั้งระบบใช้ "ตัวพิมพ์ใหญ่" เสมอ (USER, IT, ADMIN, GUEST)
// กันบั๊กตอนเทียบกับ ROLE_POLICIES ใน proxy / login route
const GUEST = {
  user: { username: "Guest", role: "GUEST", name: "Guest" },
};

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json(GUEST);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      username: string;
    };

    // ดึง role และ name จาก DB (เป็นแหล่งความจริง — เผื่อ role เปลี่ยนหลัง login)
    const [rows] = await db2.query<UserRow[]>(
      "SELECT `user`, name, role FROM ppchos.users WHERE `user` = ? LIMIT 1",
      [decoded.username],
    );

    const user = rows[0];

    return NextResponse.json({
      user: {
        username: decoded.username,
        // คนที่ยังไม่ตั้ง role (คอลัมน์เพิ่งเพิ่ม) → USER ; normalize เป็นตัวใหญ่เสมอ
        role: (user?.role ?? "USER").toUpperCase(),
        name: user?.name ?? decoded.username,
      },
    });
  } catch {
    return NextResponse.json(GUEST);
  }
}
