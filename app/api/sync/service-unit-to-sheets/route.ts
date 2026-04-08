import { NextRequest, NextResponse } from "next/server";
import { getServiceUnitReport } from "@/lib/report.service";
import { appendRowsWithDedup } from "@/lib/googleSheets";

// ── คำนวณช่วงอาทิตย์ที่แล้ว (จันทร์–อาทิตย์) ────────────────────────────────
function getLastWeekRange(): { start: string; end: string; label: string } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const dayOfWeek = now.getDay();
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday - 7);

  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // ← เปลี่ยนเป็น dd/mm/พ.ศ. ไม่มีภาษาอังกฤษ
  const fmtThai = (d: Date) => {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  };

  return {
    start: fmt(lastMonday),
    end: fmt(lastSunday),
    label: `${fmtThai(lastMonday)} – ${fmtThai(lastSunday)}`,
  };
}

// ── POST /api/sync/service-unit-to-sheets ─────────────────────────────────────
// เรียกได้ 2 แบบ:
//   1. Cron Job  → ใช้ช่วงอาทิตย์ที่แล้วอัตโนมัติ
//   2. Manual    → ส่ง body { start, end } มาเองได้
export async function POST(req: NextRequest) {
  // ตรวจ secret
  const secret = req.headers.get("x-sync-secret");
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // รับ body (ถ้ามี) สำหรับ Manual mode
    let start: string, end: string, label: string;

    const body = await req.json().catch(() => null);
    // บรรทัดที่สร้าง label จาก body.start / body.end
    if (body?.start && body?.end) {
      start = body.start;
      end = body.end;
      const toThai = (d: string) => {
        const [y, m, day] = d.split("-");
        return `${day}/${m}/${Number(y) + 543}`;
      };
      label = `${toThai(start)} – ${toThai(end)}`;
    } else {
      ({ start, end, label } = getLastWeekRange());
    }

    // ดึงข้อมูลจาก DB
    const data = await getServiceUnitReport(start, end);

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({
        success: true,
        message: "ไม่มีข้อมูลในช่วงนี้",
        dateRange: { start, end, label },
        appended: 0,
        duplicates: 0,
        newRows: 0,
      });
    }

    // Append พร้อม dedup
    const result = await appendRowsWithDedup(
      data as Record<string, unknown>[],
      label,
    );

    return NextResponse.json({
      success: true,
      dateRange: { start, end, label },
      ...result,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Sync failed", detail: String(error) },
      { status: 500 },
    );
  }
}
