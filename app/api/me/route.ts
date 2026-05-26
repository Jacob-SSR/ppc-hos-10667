import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db2 } from "@/lib/db";
import { RowDataPacket } from "mysql2";

type UserRow = RowDataPacket & { user: string; name: string; role: string };

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({
      user: { username: "Guest", role: "guest", name: "Guest" },
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      username: string;
    };

    // ดึง role และ name จาก DB
    const [rows] = await db2.query<UserRow[]>(
      "SELECT `user`, name, role FROM ppchos.users WHERE `user` = ? LIMIT 1",
      [decoded.username],
    );

    const user = rows[0];

    return NextResponse.json({
      user: {
        username: decoded.username,
        role: user?.role ?? "user",
        name: user?.name ?? decoded.username,
      },
    });
  } catch {
    return NextResponse.json({
      user: { username: "Guest", role: "guest", name: "Guest" },
    });
  }
}
