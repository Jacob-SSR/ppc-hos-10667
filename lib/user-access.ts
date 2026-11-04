import { jwtVerify } from "jose";
import type { RowDataPacket } from "mysql2";
import { db2 } from "@/lib/db";
import { FEATURE_PATHS, normalizeRole, type FeatureKey } from "@/lib/permissions";

export type UserAccess = { username: string; name: string; role: string; features: FeatureKey[] | null; revision: number };
type UserRow = RowDataPacket & { user: string; name: string | null; role: string | null };
export type AccessRow = RowDataPacket & { username: string; role_override: string | null; features_json: string | null; revision: number };

export const USER_ACCESS_DDL = `CREATE TABLE IF NOT EXISTS ppchos.user_access (
  username VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  role_override VARCHAR(32) NULL,
  features_json TEXT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

export async function ensureAccessTable(): Promise<void> {
  try { await db2.query("SELECT username FROM ppchos.user_access LIMIT 0"); }
  catch (err) {
    if ((err as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw err;
    await db2.query(USER_ACCESS_DDL);
  }
}

export function decodeFeatures(value: string | null): FeatureKey[] | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((f) => typeof f === "string" && Object.hasOwn(FEATURE_PATHS, f))) return parsed;
  } catch { /* Invalid stored grants must never fall back to a full-access role. */ }
  return [];
}

export async function getUserAccess(username: string): Promise<UserAccess | null> {
  const [users] = await db2.query<UserRow[]>("SELECT `user`, name, role FROM ppchos.users WHERE `user` = ? LIMIT 1", [username]);
  const user = users[0];
  if (!user) return null;
  let grant: AccessRow | undefined;
  try {
    const [rows] = await db2.query<AccessRow[]>("SELECT username, role_override, features_json, revision FROM ppchos.user_access WHERE username = ?", [user.user]);
    grant = rows[0];
  } catch (err) {
    // Existing installations keep role-based access until IT initializes the new table.
    if ((err as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw err;
  }
  return { username: user.user, name: user.name || user.user, role: normalizeRole(grant?.role_override ?? user.role), features: grant ? decodeFeatures(grant.features_json) : null, revision: grant?.revision ?? 0 };
}

/** JWT proves identity only. Current database permissions authorize every request. */
export async function sessionAccess(token: string | undefined): Promise<UserAccess | null> {
  if (!token) return null;
  let username: string;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!));
    if (typeof payload.username !== "string" || !payload.username) return null;
    username = payload.username;
  } catch { return null; }
  return getUserAccess(username);
}
