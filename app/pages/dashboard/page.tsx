"use client";

import { useEffect, useState } from "react";

import OpdSection from "@/app/components/dashboard/components/OpdSection";
import IpdSection from "@/app/components/dashboard/components/IpdSection";
import BedOccupancyChart from "@/app/components/dashboard/components/BedOccupancyChart";

import AnnualChart from "@/app/components/dashboard/AnnualChart";
import HomeWardSummaryCard from "@/app/components/dashboard/HomeWardSummaryCard";
import Top10Tables from "@/app/components/dashboard/Top10Tables";
import PpaOverview from "@/app/components/dashboard/PpaOverview";

import type { MonthlyDashboardRow } from "@/types/allTypes";
import { fmtDate } from "@/app/components/dashboard/components/utils/dashboard.utils";

interface MonthlyData {
  months: MonthlyDashboardRow[];
}

function getTodayBangkok(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  return fmtDate(now);
}

export default function DashboardPage() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = getTodayBangkok();

  // state วันที่ที่แชร์ระหว่าง OpdSection ↔ Top10Tables
  const [range, setRange] = useState({ start: todayStr, end: todayStr });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/monthly?months=6", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMonthlyData(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <OpdSection onRangeChange={(start, end) => setRange({ start, end })} />
      <IpdSection />
      <AnnualChart months={monthlyData?.months ?? []} loading={loading} />
      <BedOccupancyChart />
      <HomeWardSummaryCard start={todayStr} end={todayStr} />
      <Top10Tables start={range.start} end={range.end} />
      <PpaOverview />
    </div>
  );
}