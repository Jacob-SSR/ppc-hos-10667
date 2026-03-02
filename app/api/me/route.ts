import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET!
        ) as { id: number; username: string };

        return NextResponse.json({
            user: {
                id: decoded.id,
                username: decoded.username,
            },
        });
    } catch {
        return NextResponse.json({ user: null }, { status: 401 });
    }
}