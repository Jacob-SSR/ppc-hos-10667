import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { db } from "@/lib/db";


const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

function getClientIP(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for");
    return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (!record || now > record.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return { allowed: true, retryAfterSeconds: 0 };
    }

    if (record.count >= RATE_LIMIT) {
        const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
        return { allowed: false, retryAfterSeconds };
    }

    record.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
}

function resetRateLimit(ip: string) {
    loginAttempts.delete(ip);
}

// ── Handler ────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
    const ip = getClientIP(req);
    const { allowed, retryAfterSeconds } = checkRateLimit(ip);

    if (!allowed) {
        return NextResponse.json(
            { message: `พยายามเข้าสู่ระบบมากเกินไป กรุณารอ ${Math.ceil(retryAfterSeconds / 60)} นาที` },
            {
                status: 429,
                headers: { "Retry-After": String(retryAfterSeconds) },
            }
        );
    }

    const { username, password } = await req.json();

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
        return NextResponse.json({ message: "Invalid" }, { status: 400 });
    }

    const [rows]: any = await db.query(
        "SELECT * FROM users WHERE username = ?",
        [username.trim()]
    );

    const user = rows[0];

    const dummyHash = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
    const valid = await bcrypt.compare(password, user?.password ?? dummyHash);

    if (!user || !valid) {
        return NextResponse.json({ message: "Invalid" }, { status: 401 });
    }

    resetRateLimit(ip);

    const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET!,
        { expiresIn: "1d" }
    );

    const response = NextResponse.json({ message: "Login success" });

    response.cookies.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
    });

    return response;
}