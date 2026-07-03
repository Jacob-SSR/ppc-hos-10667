// app/api/servicetime/route.ts
// Service Time Dashboard (R9) — ระยะเวลารอคอย/ให้บริการ OPD จาก HOSxP (real-time)
import { NextRequest, NextResponse } from "next/server";
import { getServiceTime } from "@/lib/servicetime.queries";
import type { ServiceScope, VisitType } from "@/lib/servicetime.types";

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const def = defaultRange();
    const start = searchParams.get("start") ?? def.start;
    const end = searchParams.get("end") ?? def.end;

    const scopeRaw = searchParams.get("scope") ?? "opd";
    const vtRaw = searchParams.get("visitType") ?? "all";
    const scope: ServiceScope = SCOPES.includes(scopeRaw as ServiceScope)
      ? (scopeRaw as ServiceScope)
      : "opd";
    const visitType: VisitType = VISIT_TYPES.includes(vtRaw as VisitType)
      ? (vtRaw as VisitType)
      : "all";

    const data = await getServiceTime(start, end, scope, visitType);
    return NextResponse.json(data);
  } catch (err) {
    console.error("ServiceTime Dashboard error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(err) },
      { status: 500 },
    );
  }
}
