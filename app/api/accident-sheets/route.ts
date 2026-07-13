// app/api/accident-sheets/route.ts
// โค้ด parse/summary ย้ายไป lib/accidentSheets.service.ts (แชร์กับ /api/accident-map)
import { NextResponse } from "next/server";
import { sheetsError } from "@/lib/sheets";
import {
  getAccidentSheetsCached,
  type AccidentRow,
} from "@/lib/accidentSheets.service";

// re-export ให้ frontend เดิมที่ import type จาก route นี้ยังใช้ได้
export type { AccidentRow };

export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const data = await getAccidentSheetsCached();

    if (debug) {
      return NextResponse.json({
        headers: data.headers,
        sampleRow: data.sampleRow,
        treatDateSamples: data.rows
          .slice(0, 10)
          .map((r) => ({ hn: r.hn, treatDate: r.treatDate })),
        byDayCount: data.summary.byDay.length,
        totalRows: data.rows.length,
        cachedAt: data.updatedAt, // ให้รู้ว่า debug กำลังดูข้อมูล ณ เวลาไหน
      });
    }

    const { headers: _h, sampleRow: _s, ...publicData } = data;
    return NextResponse.json(publicData);
  } catch (err) {
    return sheetsError(err, "AccidentSheets");
  }
}
