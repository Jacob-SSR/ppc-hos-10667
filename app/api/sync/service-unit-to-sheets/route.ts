import crypto from "crypto";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { getServiceUnitReport } from "@/lib/report.service";
import { appendRowsWithDedup } from "@/lib/googleSheets";

// ── Auth ─────────────────────────────────────────────────────────────────────
// 1) Cron    → header x-sync-secret ต้องตรงกับ env SYNC_SECRET (ไม่มีค่า default —
//              ไม่ตั้ง env = ปิดช่องทาง cron ไปเลย ไม่ใช่เปิดกว้าง)
// 2) Manual  → ผู้ใช้ที่ login แล้วกดจากหน้าเว็บ ใช้ cookie token ตามปกติ
//              (ห้ามฝัง secret ในโค้ดฝั่ง client เด็ดขาด)

/** เทียบ secret แบบ timing-safe — hash ก่อนเทียบ กันทั้ง timing attack และความยาวไม่เท่ากัน */
function syncSecretMatches(given: string | null): boolean {
  const expected = process.env.SYNC_SECRET;
  if (!expected || !given) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function hasValidLogin(req: NextRequest): boolean {
  const token = req.cookies.get("token")?.value;
  if (!token) return false;
  try {
    jwt.verify(token, process.env.JWT_SECRET!);
    return true;
  } catch {
    return false;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  const secretHeader = req.headers.get("x-sync-secret");
  if (!syncSecretMatches(secretHeader) && !hasValidLogin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // รับ body (ถ้ามี) สำหรับ Manual mode
    let start: string, end: string, label: string;

    const body = await req.json().catch(() => null);
    // บรรทัดที่สร้าง label จาก body.start / body.end
    if (body?.start && body?.end) {
      if (!DATE_RE.test(body.start) || !DATE_RE.test(body.end)) {
        return NextResponse.json(
          { error: "รูปแบบวันที่ต้องเป็น YYYY-MM-DD" },
          { status: 400 },
        );
      }
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
