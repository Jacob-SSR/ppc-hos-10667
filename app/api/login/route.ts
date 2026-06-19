import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import md5 from "md5";
import { db2 } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rateLimit";

type UserRow = RowDataPacket & {
  user: string;
  passweb: string;
  role: string | null; // เพิ่งเพิ่มคอลัมน์ — คนเก่าจะเป็น NULL
};

const MINUTE = 60_000;

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // ── ชั้นที่ 1: จำกัดตาม IP — 10 ครั้ง / 5 นาที ──
  const ipLimit = rateLimit(`login:ip:${ip}`, 10, 5 * MINUTE);
  if (!ipLimit.ok) {
    return tooManyRequests(ipLimit, "พยายาม login บ่อยเกินไป กรุณารอสักครู่");
  }

  const body = await req.json();
  const username = body.username?.trim();
  const password = body.password?.trim();

  if (!username || !password) {
    return NextResponse.json({ message: "Invalid" }, { status: 400 });
  }

  // ── ชั้นที่ 2: จำกัดตาม username — 5 ครั้ง / 15 นาที ──
  const userLimit = rateLimit(
    `login:user:${username.toLowerCase()}`,
    5,
    15 * MINUTE,
  );
  if (!userLimit.ok) {
    return tooManyRequests(
      userLimit,
      "บัญชีนี้ถูกพยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่",
    );
  }

  const [rows] = await db2.query<UserRow[]>(
    "SELECT `user`, passweb, role FROM ppchos.users WHERE `user` = ? LIMIT 1",
    [username],
  );

  const user = rows[0];

  if (!rows.length) {
    return NextResponse.json({ message: "Invalid" }, { status: 401 });
  }

  let isValid = false;

  if (user.passweb.startsWith("$2b$") || user.passweb.startsWith("$2a$")) {
    isValid = await bcrypt.compare(password, user.passweb);
  } else {
    isValid = md5(password).toLowerCase() === user.passweb.toLowerCase();
    if (isValid) {
      const newHash = await bcrypt.hash(password, 12);
      await db2.query("UPDATE ppchos.users SET passweb = ? WHERE `user` = ?", [
        newHash,
        username,
      ]);
    }
  }

  if (!isValid) {
    return NextResponse.json({ message: "Invalid" }, { status: 401 });
  }

  // คนที่ยังไม่ได้ตั้ง role (คอลัมน์เพิ่งเพิ่ม) → ถือเป็น "USER" ธรรมดา
  // ⚠️ ต้อง fallback เสมอ ไม่งั้น role เป็น undefined แล้ว proxy ที่เช็ค role จะปฏิเสธ
  const role = (user.role ?? "USER").toUpperCase();

  const token = jwt.sign(
    { username: user.user, role },
    process.env.JWT_SECRET!,
    { expiresIn: "8h" },
  );

  // ⚠️ secure cookie ส่งได้เฉพาะผ่าน HTTPS — ตอนนี้ยังเป็น HTTP จึงคุมด้วย env
  //    ตั้ง COOKIE_SECURE=false ระหว่างยังไม่มี HTTPS ; พอขึ้น HTTPS แล้วเปลี่ยนเป็น true
  //    (ถ้า true บน HTTP browser จะไม่เก็บ cookie → login แล้วกลายเป็น guest)
  const secureCookie = process.env.COOKIE_SECURE === "true";

  // ส่ง role กลับให้ client ใช้ตัดสินใจ redirect หลัง login
  const res = NextResponse.json({ message: "Login success", role });
  res.cookies.set("token", token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
