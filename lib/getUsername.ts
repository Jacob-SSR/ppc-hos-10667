// lib/getUsername.ts
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

/** ดึง username จาก JWT cookie (คืน null ถ้าไม่มี/invalid) */
export async function getUsername(): Promise<string | null> {
  try {
    const token = (await cookies()).get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      username: string;
    };
    return decoded.username ?? null;
  } catch {
    return null;
  }
}
