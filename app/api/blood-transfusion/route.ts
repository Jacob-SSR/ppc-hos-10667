// app/api/blood-transfusion/route.ts
import { NextResponse } from "next/server";
import { bloodTransfusionDiagnostics, getBloodTransfusion } from "@/lib/bloodTransfusion.service";
import { cachedQuery, defaultMaxAge } from "@/lib/cache";
import { jsonCached } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

const TTL_SECONDS = 300;

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // โหมดวินิจฉัย: ดูว่า HOSxP ที่นี่เก็บ Extension Code / เวลาเริ่ม-สิ้นสุด ไว้คอลัมน์ไหน (ไม่ cache)
    if (searchParams.get("diag") === "1") {
      return NextResponse.json({ diagnostics: await bloodTransfusionDiagnostics() });
    }

    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (!validDate(start) || !validDate(end) || start > end) {
      return NextResponse.json({ error: "ช่วงวันที่ไม่ถูกต้อง" }, { status: 400 });
    }

    const data = await cachedQuery(
      ["blood-transfusion", start, end],
      () => getBloodTransfusion(start, end),
      TTL_SECONDS,
    );
    return jsonCached(req, data, { maxAge: defaultMaxAge(TTL_SECONDS) });
  } catch (error) {
    console.error("BloodTransfusion API error:", error);
    return NextResponse.json(
      { error: "ดึงข้อมูลผู้ป่วยที่ได้รับเลือดไม่สำเร็จ: " + (error as Error).message },
      { status: 500 },
    );
  }
}
