import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { getDashboardData } from "@/lib/dashboard";

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

// dashboard กลาง (จอทีวี guest) — เดิมยิง HosXP ตรงทุก request
const TTL_SECONDS = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  const { start, end } =
    startParam && endParam
      ? { start: startParam, end: endParam }
      : getCurrentMonthRange();

  try {
    return await cachedJson(
      req,
      ["dashboard", start, end],
      async () => ({ ...(await getDashboardData(start, end)), start, end }),
      TTL_SECONDS,
    );
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
