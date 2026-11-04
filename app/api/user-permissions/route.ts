import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db2 } from "@/lib/db";
import { canManageUsers, normalizeRole, parseUserPermissionUpdate } from "@/lib/permissions";
import { decodeFeatures, ensureAccessTable, sessionAccess, type AccessRow } from "@/lib/user-access";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
type UserRow = RowDataPacket & { user: string; name: string | null; role: string | null };

export async function GET(req: NextRequest) {
  try {
    const actor = await sessionAccess(req.cookies.get("token")?.value);
    if (!actor) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
    if (!canManageUsers(actor.role)) return json({ error: "เฉพาะ IT เท่านั้นที่จัดการสิทธิ์ผู้ใช้ได้" }, 403);
    // Only an authenticated IT request may initialize the additive table.
    await ensureAccessTable();
    const search = (req.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 100);
    const rawPage = Number(req.nextUrl.searchParams.get("page") ?? 1);
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1;
    const pattern = `%${search.replace(/[!%_]/g, "!$&")}%`;
    const where = "WHERE (`user` LIKE ? ESCAPE '!' OR name LIKE ? ESCAPE '!')";
    const [counts] = await db2.query<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) AS total FROM ppchos.users ${where}`, [pattern, pattern]);
    const [rows] = await db2.query<UserRow[]>(`SELECT \`user\`, name, role FROM ppchos.users ${where} ORDER BY \`user\` LIMIT 50 OFFSET ?`, [pattern, pattern, (page - 1) * 50]);
    let grants: AccessRow[] = [];
    if (rows.length) {
      [grants] = await db2.query<AccessRow[]>(`SELECT username, role_override, features_json, revision FROM ppchos.user_access WHERE username IN (${rows.map(() => "?").join(",")})`, rows.map((r) => r.user));
    }
    const grantByUser = new Map(grants.map((r) => [r.username, r]));
    const users = rows.map((r) => {
      const grant = grantByUser.get(r.user);
      return { username: r.user, name: r.name || r.user, role: normalizeRole(grant?.role_override ?? r.role), features: grant ? decodeFeatures(grant.features_json) : null, revision: grant?.revision ?? 0 };
    });
    return json({ users, total: Number(counts[0].total), page, pageSize: 50, currentUsername: actor.username });
  } catch (err) {
    console.error("User permissions list:", (err as { code?: string }).code ?? "unknown");
    return json({ error: "โหลดผู้ใช้ไม่ได้ กรุณาตรวจการเชื่อมต่อและสิทธิ์ CREATE ตาราง ppchos.user_access" }, 503);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host")) return json({ error: "คำขอไม่ถูกต้อง" }, 403);
    const actor = await sessionAccess(req.cookies.get("token")?.value);
    if (!actor) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
    if (!canManageUsers(actor.role)) return json({ error: "เฉพาะ IT เท่านั้นที่จัดการสิทธิ์ผู้ใช้ได้" }, 403);
    let patch: ReturnType<typeof parseUserPermissionUpdate>;
    try { patch = parseUserPermissionUpdate(await req.json()); }
    catch (err) { return json({ error: (err as Error).message }, 400); }
    await ensureAccessTable();
    const conn = await db2.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("INSERT IGNORE INTO ppchos.user_access (username, revision, updated_by) VALUES (?, 0, ?)", [actor.username, actor.username]);
      const [actorGrants] = await conn.query<AccessRow[]>("SELECT username, role_override, features_json, revision FROM ppchos.user_access WHERE username = ? FOR UPDATE", [actor.username]);
      // Recheck the actor under a lock so a concurrent demotion cannot authorize a write.
      const [actors] = await conn.query<UserRow[]>("SELECT `user`, name, role FROM ppchos.users WHERE `user` = ? LIMIT 1 FOR UPDATE", [actor.username]);
      if (!actors[0] || !canManageUsers(actorGrants[0]?.role_override ?? actors[0].role)) { await conn.rollback(); return json({ error: "สิทธิ์ IT ของคุณเปลี่ยนแล้ว กรุณารีเฟรช" }, 403); }
      const [targets] = await conn.query<UserRow[]>("SELECT `user`, name, role FROM ppchos.users WHERE `user` = ? LIMIT 1 FOR UPDATE", [patch.username]);
      const target = targets[0];
      if (!target) { await conn.rollback(); return json({ error: "ไม่พบบัญชีผู้ใช้" }, 404); }
      if (target.user === actors[0].user && patch.role !== "IT") { await conn.rollback(); return json({ error: "ไม่สามารถยกเลิกสิทธิ์ IT ของบัญชีที่กำลังใช้งาน" }, 400); }
      const [current] = await conn.query<AccessRow[]>("SELECT username, features_json, revision FROM ppchos.user_access WHERE username = ? FOR UPDATE", [target.user]);
      if ((current[0]?.revision ?? 0) !== patch.revision) { await conn.rollback(); return json({ error: "มีผู้แก้ไขสิทธิ์บัญชีนี้แล้ว กรุณาโหลดรายชื่อใหม่และเลือกบัญชีอีกครั้ง" }, 409); }
      const revision = patch.revision + 1;
      await conn.query(`INSERT INTO ppchos.user_access (username, role_override, features_json, revision, updated_by) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE role_override = VALUES(role_override), features_json = VALUES(features_json), revision = VALUES(revision), updated_by = VALUES(updated_by)`,
      [target.user, patch.role, patch.features === null ? null : JSON.stringify(patch.features), revision, actor.username]);
      await conn.commit();
      return json({ user: { username: target.user, name: target.name || target.user, role: patch.role, features: patch.features, revision } });
    } catch (err) { await conn.rollback(); throw err; }
    finally { conn.release(); }
  } catch (err) {
    console.error("User permission save:", (err as { code?: string }).code ?? "unknown");
    return json({ error: "บันทึกสิทธิ์ไม่สำเร็จ กรุณาลองใหม่" }, 503);
  }
}
