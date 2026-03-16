import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import md5 from "md5";
import { db } from "@/lib/db";

export async function POST(req: Request) {

    const body = await req.json();

    const username = body.username?.trim();
    const password = body.password?.trim();

    if (!username || !password) {
        return NextResponse.json({ message: "Invalid" }, { status: 400 });
    }

    const [rows]: any = await db.query(
        "SELECT `user`, passweb FROM ppchos.users WHERE `user` = ? LIMIT 1",
        [username]
    );

    const user = rows[0];

    if (!user || !user.passweb) {
        return NextResponse.json({ message: "Invalid" }, { status: 401 });
    }

    const hashed = md5(password);

    if (hashed !== user.passweb) {
        return NextResponse.json({ message: "Invalid" }, { status: 401 });
    }

    const token = jwt.sign(
        { username: user.user },
        process.env.JWT_SECRET!,
        { expiresIn: "1d" }
    );

    const res = NextResponse.json({ message: "Login success" });

    res.cookies.set("token", token, {
        httpOnly: true,
        path: "/",
    });

    return res;
}