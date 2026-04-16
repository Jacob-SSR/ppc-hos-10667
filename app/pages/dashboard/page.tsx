"use client";

import { useEffect, useState } from "react";
import OpdSection from "@/app/components/dashboard/OpdSection";
import IpdSection from "@/app/components/dashboard/IpdSection";
import AnnualChart from "@/app/components/dashboard/AnnualChart";
import BedOccupancyChart from "@/app/components/dashboard/BedOccupancyChart";
import HomeWardTable from "@/app/components/dashboard/HomeWardTable";
import Top10Tables from "@/app/components/dashboard/Top10Tables";
import PpaOverview from "@/app/components/dashboard/PpaOverview";

export default function DashboardPage() {
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    fetch(`/api/dashboard/monthly?months=6`, { credentials: "include" })
      .then((r) => r.json())
      .then(setMonthlyData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {/* OPD Section — จัดการ fetch เอง ตาม date picker */}
      <OpdSection />

      {/* IPD Section */}
      <IpdSection loading={false} dateLabel={todayStr} />

      {/* Annual Chart */}
      <AnnualChart months={monthlyData?.months ?? []} loading={loading} />

      {/* Bed Occupancy Chart — ดึงข้อมูลจริงจาก API */}
      <BedOccupancyChart />

      {/* Home Ward Tables */}
      <HomeWardTable start={todayStr} end={todayStr} />

      {/* Top 10 OPD / IPD */}
      <Top10Tables start={todayStr} end={todayStr} />

      {/* PPA Overview */}
      <PpaOverview />
    </div>
  );
}
