// app/api/pt-dashboard/route.ts
// Dashboard กายภาพบำบัด — ส่ง records[] + queue[] ให้ฝั่ง client ไปคำนวณทุก section
// รับ ?preset=today|7days|30days|thismonth  หรือ  ?start=YYYY-MM-DD&end=YYYY-MM-DD
import { NextResponse } from "next/server";
import { getPtDashboard } from "@/lib/pt.service";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function rangeFromPreset(preset: string): { start: string; end: string } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = fmt(today);

  if (preset === "7days") {
    const s = new Date(today);
    s.setDate(s.getDate() - 6);
    return { start: fmt(s), end };
  }
  if (preset === "30days") {
    const s = new Date(today);
    s.setDate(s.getDate() - 29);
    return { start: fmt(s), end };
  }
  if (preset === "thismonth") {
    return {
      start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
      end,
    };
  }
  // today (default)
  return { start: end, end };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const preset = searchParams.get("preset") ?? "today";

    const { start, end } =
      startParam && endParam
        ? { start: startParam, end: endParam }
        : rangeFromPreset(preset);

    const data = await getPtDashboard(start, end);
    return NextResponse.json({ ...data, start, end });
  } catch (error) {
    console.error("PT dashboard error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
