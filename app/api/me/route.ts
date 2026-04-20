import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({
      user: { username: "Guest", role: "guest" },
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      username: string;
    };

    return NextResponse.json({
      user: {
        username: decoded.username,
        role: "user",
      },
    });
  } catch {
    return NextResponse.json({
      user: { username: "Guest", role: "guest" },
    });
  }
}
