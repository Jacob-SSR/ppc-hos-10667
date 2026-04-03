import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import md5 from "md5";
import { db2 } from "@/lib/db";

export async function POST(req: Request) {
    const body = await req.json();

    const username = body.username?.trim();
    const password = body.password?.trim();

    if (!username || !password) {
        return NextResponse.json({ message: "Invalid" }, { status: 400 });
    }

    const [rows]: any = await db2.query(
        "SELECT `user`, passweb FROM ppchos.users WHERE `user` = ? LIMIT 1",
        [username]
    );

    const user = rows[0];

    if (!user || !user.passweb) {
        return NextResponse.json({ message: "Invalid" }, { status: 401 });
    }

    let isValid = false;

    if (user.passweb.startsWith("$2b$") || user.passweb.startsWith("$2a$")) {
        isValid = await bcrypt.compare(password, user.passweb);
    } else {
        isValid = md5(password) === user.passweb;

        if (isValid) {
            const newHash = await bcrypt.hash(password, 12);
            await db2.query(
                "UPDATE ppchos.users SET passweb = ? WHERE `user` = ?",
                [newHash, username]
            );
        }
    }

    if (!isValid) {
        return NextResponse.json({ message: "Invalid" }, { status: 401 });
    }

    const token = jwt.sign(
        { username: user.user },
        process.env.JWT_SECRET!,
        { expiresIn: "8h" }
    );

    const res = NextResponse.json({ message: "Login success" });

    res.cookies.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
    });
    return res;
}