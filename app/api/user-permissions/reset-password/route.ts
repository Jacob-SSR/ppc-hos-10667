import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import type { RowDataPacket } from "mysql2";
import { db2 } from "@/lib/db";
import { canManageUsers } from "@/lib/permissions";
import { ensureAccessTable, sessionAccess, type AccessRow } from "@/lib/user-access";
import { parsePasswordReset, PASSWORD_RESET_AUDIT_DDL } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
type UserRow = RowDataPacket & { user: string; role: string | null };

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host")) return json({ error: "คำขอไม่ถูกต้อง" }, 403);
    const actor = await sessionAccess(req.cookies.get("token")?.value);
    if (!actor) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
    if (!canManageUsers(actor.role)) return json({ error: "เฉพาะ IT เท่านั้นที่ตั้งรหัสผ่านให้ผู้ใช้อื่นได้" }, 403);
    let input: ReturnType<typeof parsePasswordReset>;
    try { input = parsePasswordReset(await req.json()); }
    catch (err) { return json({ error: (err as Error).message }, 400); }

    const limit = await rateLimit(`password-reset:${actor.username}`, 20, 5 * 60_000);
    if (!limit.ok) return NextResponse.json({ error: "ตั้งรหัสผ่านบ่อยเกินไป กรุณารอสักครู่" }, {
      status: 429, headers: { ...headers, "Retry-After": String(limit.retryAfterSec) },
    });
    const hash = await bcrypt.hash(input.newPassword, 12);
    await ensureAccessTable();
    try { await db2.query("SELECT id FROM ppchos.password_reset_audit LIMIT 0"); }
    catch (err) {
      if ((err as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw err;
      await db2.query(PASSWORD_RESET_AUDIT_DDL);
    }
    const conn = await db2.getConnection();
    try {
      await conn.beginTransaction();
      // Match the permission editor's lock order and recheck live IT access.
      await conn.query("INSERT IGNORE INTO ppchos.user_access (username, revision, updated_by) VALUES (?, 0, ?)", [actor.username, actor.username]);
      const [grants] = await conn.query<AccessRow[]>("SELECT role_override FROM ppchos.user_access WHERE username = ? FOR UPDATE", [actor.username]);
      const [actors] = await conn.query<UserRow[]>("SELECT `user`, role FROM ppchos.users WHERE `user` = ? LIMIT 1 FOR UPDATE", [actor.username]);
      if (!actors[0] || !canManageUsers(grants[0]?.role_override ?? actors[0].role)) {
        await conn.rollback(); return json({ error: "สิทธิ์ IT ของคุณเปลี่ยนแล้ว กรุณารีเฟรช" }, 403);
      }
      const [targets] = await conn.query<UserRow[]>("SELECT `user`, role FROM ppchos.users WHERE `user` = ? LIMIT 1 FOR UPDATE", [input.username]);
      if (!targets[0]) { await conn.rollback(); return json({ error: "ไม่พบบัญชีผู้ใช้" }, 404); }
      const target = targets[0].user;
      if (target === actors[0].user) {
        await conn.rollback(); return json({ error: "เปลี่ยนรหัสของตัวเองได้ที่ตั้งค่าบัญชี" }, 400);
      }
      await conn.query("UPDATE ppchos.users SET passweb = ? WHERE `user` = ?", [hash, target]);
      // No password or hash is stored in the audit trail or returned to the browser.
      await conn.query("INSERT INTO ppchos.password_reset_audit (actor_username, target_username) VALUES (?, ?)", [actors[0].user, target]);
      await conn.commit();
      return json({ success: true, username: target });
    } catch (err) { await conn.rollback(); throw err; }
    finally { conn.release(); }
  } catch (err) {
    console.error("Password reset failed:", (err as { code?: string }).code ?? "unknown");
    return json({ error: "ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่ หรือตรวจสิทธิ์ฐานข้อมูลสำหรับตาราง password_reset_audit" }, 503);
  }
}
