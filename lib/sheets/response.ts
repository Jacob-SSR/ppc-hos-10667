// lib/sheets/response.ts
// Error response มาตรฐานสำหรับ *-sheets route — เดิม catch block ซ้ำเป๊ะทุกไฟล์
import { NextResponse } from "next/server";

/**
 * แทนที่ catch block ที่ซ้ำ:
 *   } catch (err) {
 *     console.error("XxxSheets error:", err);
 *     return NextResponse.json({ error: "ดึงข้อมูล..." }, { status: 500 });
 *   }
 *
 * การใช้: } catch (err) { return sheetsError(err, "AccidentSheets"); }
 */
export function sheetsError(err: unknown, tag: string) {
  console.error(`${tag} error:`, err);
  return NextResponse.json(
    {
      error: "ดึงข้อมูลจาก Google Sheets ไม่สำเร็จ: " + (err as Error).message,
    },
    { status: 500 },
  );
}
