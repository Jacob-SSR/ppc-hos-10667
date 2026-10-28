// lib/diagtext-dashboard.server.ts
// ส่วนที่ต้องแตะ db ของ dashboard diagtext — แยกจาก lib/diagtext-dashboard.ts ให้ไฟล์นั้นเทสต์ได้โดยไม่ต้องมี db
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { cachedQuery } from "@/lib/cache";
import { pickPersonSource, type PersonSource } from "@/lib/diagtext-dashboard";

/** คอลัมน์ผู้ลงใน ovst_doctor_diag — schema ไม่ค่อยเปลี่ยน cache ไว้ 1 วัน */
export function personSource(): Promise<PersonSource> {
  return cachedQuery(["diagtext", "person-source"], async () => {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ovst_doctor_diag'`,
      );
      return pickPersonSource(rows.map((r) => String(r.c)));
    } catch {
      return pickPersonSource([]);
    }
  }, 86400);
}

export async function select<T>(q: { sql: string; values: unknown[] }) {
  const [rows] = await db.query<(T & RowDataPacket)[]>({ sql: q.sql, timeout: 60000 }, q.values);
  return rows as T[];
}
