// app/api/servicetime/route.ts
// Service Time Dashboard (R9) — ระยะเวลารอคอย/ให้บริการ OPD จาก HOSxP (real-time)
import { NextRequest, NextResponse } from "next/server";
import { getServiceTime } from "@/lib/servicetime.queries";
import type {
  ServiceScope,
  VisitType,
  ServiceShift,
} from "@/lib/servicetime.types";

export const dynamic = "force-dynamic";

function defaultRange() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

const SCOPES: ServiceScope[] = ["all", "opd", "er"];
const VISIT_TYPES: VisitType[] = ["all", "appt", "walkin"];
const SHIFTS: ServiceShift[] = ["all", "morning", "evening", "night"];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const def = defaultRange();
    const start = searchParams.get("start") ?? def.start;
    const end = searchParams.get("end") ?? def.end;

    const scopeRaw = searchParams.get("scope") ?? "opd";
    const vtRaw = searchParams.get("visitType") ?? "all";
    const shiftRaw = searchParams.get("shift") ?? "all";
    const scope: ServiceScope = SCOPES.includes(scopeRaw as ServiceScope)
      ? (scopeRaw as ServiceScope)
      : "opd";
    const visitType: VisitType = VISIT_TYPES.includes(vtRaw as VisitType)
      ? (vtRaw as VisitType)
      : "all";
    const shift: ServiceShift = SHIFTS.includes(shiftRaw as ServiceShift)
      ? (shiftRaw as ServiceShift)
      : "all";

    // คลินิก: ส่งชื่อแผนกมาตรง ๆ ("all" = ทุกคลินิก) — ใช้กรองในชั้น JS เท่านั้น ไม่แตะ SQL
    const clinic = (searchParams.get("clinic") ?? "all").trim() || "all";

    // เป้าหมายเวลารวม (นาที) — validate ที่ชั้น query อีกที
    const targetRaw = searchParams.get("target");
    const target = targetRaw != null ? Number(targetRaw) : null;

    const data = await getServiceTime(
      start,
      end,
      scope,
      visitType,
      shift,
      clinic,
      target,
    );
    return NextResponse.json(data);
  } catch (err) {
    console.error("ServiceTime Dashboard error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(err) },
      { status: 500 },
    );
  }
}
