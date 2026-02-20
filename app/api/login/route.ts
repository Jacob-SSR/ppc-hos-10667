import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { db } from "@/lib/db";

export async function POST(req: Request) {
    const { username, password } = await req.json();

    const [rows]: any = await db.query(
        "SELECT * FROM users WHERE username = ?",
        [username]
    );

    const user = rows[0];

    if (!user) {
        return NextResponse.json({ message: "Invalid" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
        return NextResponse.json({ message: "Invalid" }, { status: 401 });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET!,
        { expiresIn: "1d" }
    );

    const response = NextResponse.json({ message: "Login success" });

    response.cookies.set("token", token, {
        httpOnly: true,
        path: "/",
    });

    return response;
}