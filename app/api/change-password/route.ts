import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db2 } from "@/lib/db";
import { RowDataPacket } from "mysql2";

type UserRow = RowDataPacket & { user: string; passweb: string };

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token)
      return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      username: string;
    };
    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword)
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 },
      );
    if (newPassword.length < 6)
      return NextResponse.json(
        { error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" },
        { status: 400 },
      );

    const [rows] = await db2.query<UserRow[]>(
      "SELECT `user`, passweb FROM ppchos.users WHERE `user` = ? LIMIT 1",
      [decoded.username],
    );
    if (!rows.length)
      return NextResponse.json({ error: "ไม่พบผู้ใช้งาน" }, { status: 404 });

    const isValid = await bcrypt.compare(currentPassword, rows[0].passweb);
    if (!isValid)
      return NextResponse.json(
        { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
        { status: 400 },
      );

    const newHash = await bcrypt.hash(newPassword, 12);
    await db2.query("UPDATE ppchos.users SET passweb = ? WHERE `user` = ?", [
      newHash,
      decoded.username,
    ]);

    return NextResponse.json({
      success: true,
      message: "เปลี่ยนรหัสผ่านสำเร็จ",
    });
  } catch (err) {
    console.error("Change password error:", err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 },
    );
  }
}
